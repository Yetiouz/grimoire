-- 0017: sealed outcome bands (SLICE_17_SPEC.md, decision 1).
--
-- gm_checks holds a check the GM has called for, with EVERY outcome
-- committed before any die exists. The bands column is sealed: RLS on
-- this table has NO select policy, so the only reads are the SECURITY
-- DEFINER functions below — and gm_list_checks never returns `bands`.
-- An unresolved outcome is hypothetical and must be unreachable by any
-- client path; a resolved check exposes exactly the one band that
-- became real (copied into resolved_band at resolution time).
--
-- NOTE: gm_create_check as defined here was superseded by 0020 in the
-- same working session (it allowed session-less checks, which are
-- unresolvable). Kept verbatim for the migration record.

create table gm_checks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  session_id uuid references sessions(id),
  character_id uuid references characters(id),
  ability text not null,
  dc integer not null,
  advantage text check (advantage in ('advantage', 'disadvantage')),
  stakes text,
  -- [{min, max, text, hp_delta?, hp_reason?}] — contiguous, covering
  -- every reachable total. Sealed; see above.
  bands jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'abandoned')),
  resolved_total integer,
  resolved_roll integer,
  resolved_source text check (resolved_source in ('server', 'physical')),
  resolved_band jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table gm_checks enable row level security;
-- Deliberately NO policies: the table is reachable only through the
-- SECURITY DEFINER functions below. This is what "sealed" means.

-- Membership guard shared by everything here.
create or replace function gm_check_is_member(p_campaign_id uuid)
returns boolean
language sql security definer set search_path = public as $grim$
  select exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = auth.uid()
  );
$grim$;

-- Called by the edge function (caller JWT) when the GM emits a check.
-- Validates band coverage so an unmatchable total can't exist: bands
-- must be non-empty, each {min,max,text} sane, and jointly cover -20
-- through 60 with no gaps (any d20 total with any realistic modifier).
create or replace function gm_create_check(
  p_campaign_id uuid,
  p_session_id uuid,
  p_character_id uuid,
  p_ability text,
  p_dc integer,
  p_advantage text,
  p_stakes text,
  p_bands jsonb
) returns uuid
language plpgsql security definer set search_path = public as $grim$
declare
  v_id uuid;
  v_band jsonb;
  v_prev_max integer := null;
  v_first_min integer := null;
  v_last_max integer := null;
begin
  if not gm_check_is_member(p_campaign_id) then
    raise exception 'not a member of this campaign';
  end if;
  if jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) < 2 then
    raise exception 'bands must be an array of at least 2';
  end if;
  for v_band in select * from jsonb_array_elements(p_bands) loop
    if v_band->>'text' is null or (v_band->>'min') is null or (v_band->>'max') is null then
      raise exception 'each band needs min, max, text';
    end if;
    if (v_band->>'min')::int > (v_band->>'max')::int then
      raise exception 'band min > max';
    end if;
    if v_first_min is null then
      v_first_min := (v_band->>'min')::int;
    elsif (v_band->>'min')::int <> v_prev_max + 1 then
      raise exception 'bands must be contiguous and ascending';
    end if;
    v_prev_max := (v_band->>'max')::int;
    v_last_max := v_prev_max;
  end loop;
  if v_first_min > -20 or v_last_max < 60 then
    raise exception 'bands must cover totals -20..60';
  end if;

  -- One live check at a time per campaign keeps the table honest: a
  -- newer ask supersedes anything still hanging (spec: "a newer check
  -- on the same subject supersedes").
  update gm_checks set status = 'abandoned'
  where campaign_id = p_campaign_id and status = 'pending';

  insert into gm_checks (campaign_id, session_id, character_id, ability, dc, advantage, stakes, bands)
  values (p_campaign_id, p_session_id, p_character_id, p_ability, p_dc, p_advantage, p_stakes, p_bands)
  returning id into v_id;
  return v_id;
end;
$grim$;

-- The ONLY general read path — and it never selects `bands`.
create or replace function gm_list_checks(p_campaign_id uuid)
returns table (
  id uuid, session_id uuid, character_id uuid, ability text, dc integer,
  advantage text, stakes text, status text, resolved_total integer,
  resolved_roll integer, resolved_source text, resolved_band jsonb,
  created_at timestamptz, resolved_at timestamptz
)
language sql security definer set search_path = public as $grim$
  select c.id, c.session_id, c.character_id, c.ability, c.dc,
         c.advantage, c.stakes, c.status, c.resolved_total,
         c.resolved_roll, c.resolved_source, c.resolved_band,
         c.created_at, c.resolved_at
  from gm_checks c
  where c.campaign_id = p_campaign_id
    and gm_check_is_member(c.campaign_id)
  order by c.created_at desc;
$grim$;

-- Resolution: one command, two sources (spec decision 2).
--   source 'server'   -> p_total ignored; the server rolls d20 (adv/dis
--                        as two dice), applies the character's ability
--                        modifier, computes the total itself.
--   source 'physical' -> the player rolled real dice and types the
--                        final total; stored flagged so the ledger is
--                        honest about provenance. Raw roll unknown.
-- Applies the matched band immediately (spec decision 3): outcome text
-- logs as GM narration (cyan, same as every GM reply), hp_delta applies
-- through the same adjust_character_hp command a human uses.
create or replace function resolve_check(
  p_check_id uuid,
  p_source text,
  p_total integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $grim$
declare
  v_check gm_checks%rowtype;
  v_roll integer := null;
  v_roll2 integer;
  v_mod integer := 0;
  v_total integer;
  v_band jsonb := null;
  v_idx integer := -1;
  v_i integer := 0;
  v_b jsonb;
  v_abilities jsonb;
begin
  select * into v_check from gm_checks where id = p_check_id;
  if v_check.id is null then raise exception 'no such check'; end if;
  if not gm_check_is_member(v_check.campaign_id) then
    raise exception 'not a member of this campaign';
  end if;
  if v_check.status <> 'pending' then
    raise exception 'check is %', v_check.status;
  end if;
  if p_source not in ('server', 'physical') then
    raise exception 'source must be server or physical';
  end if;

  if p_source = 'server' then
    v_roll := floor(random() * 20)::int + 1;
    if v_check.advantage is not null then
      v_roll2 := floor(random() * 20)::int + 1;
      if v_check.advantage = 'advantage' then
        v_roll := greatest(v_roll, v_roll2);
      else
        v_roll := least(v_roll, v_roll2);
      end if;
    end if;
    if v_check.character_id is not null then
      select abilities into v_abilities from characters where id = v_check.character_id;
      if v_abilities ? lower(v_check.ability) then
        v_mod := floor(((v_abilities->>lower(v_check.ability))::int - 10) / 2.0)::int;
      end if;
    end if;
    v_total := v_roll + v_mod;
  else
    if p_total is null then raise exception 'physical resolution needs the total'; end if;
    v_total := p_total;
  end if;

  for v_b in select * from jsonb_array_elements(v_check.bands) loop
    if v_total >= (v_b->>'min')::int and v_total <= (v_b->>'max')::int then
      v_band := v_b; v_idx := v_i; exit;
    end if;
    v_i := v_i + 1;
  end loop;
  if v_band is null then
    raise exception 'no band for total % — bands invalid', v_total;
  end if;

  update gm_checks set
    status = 'resolved',
    resolved_total = v_total,
    resolved_roll = v_roll,
    resolved_source = p_source,
    resolved_band = v_band,
    resolved_at = now()
  where id = p_check_id;

  -- The outcome becomes real through the same commands a human uses.
  perform log_journal_entry(
    v_check.campaign_id, v_check.session_id, 'narration',
    v_band->>'text', 'GM', '#35f0ff'
  );
  if v_check.character_id is not null and (v_band ? 'hp_delta')
     and (v_band->>'hp_delta')::int <> 0 then
    perform adjust_character_hp(
      v_check.character_id, (v_band->>'hp_delta')::int, v_check.session_id
    );
  end if;

  return jsonb_build_object(
    'total', v_total, 'roll', v_roll, 'modifier', v_mod,
    'source', p_source, 'band', v_band, 'band_index', v_idx
  );
end;
$grim$;
