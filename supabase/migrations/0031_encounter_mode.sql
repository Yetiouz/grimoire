-- 0031_encounter_mode.sql
-- Encounter mode phase 1 (BUILD_PLAN.md item 13, the last unbuilt item --
-- scope doc: grimoire-phase19-encounter-mode-scope.md). Data layer +
-- commands only, per that doc's decision #4: monsters + initiative +
-- turn order, no UI yet, no dying/stabilize/morale (that's phase 3 of
-- the encounter-mode build order, a separate future migration).
--
-- Grounded directly in the rulebook (pg. 83, 88-90), not re-derived
-- from memory -- see the scope doc's own "what the rulebook actually
-- requires" section. Two new tables, same "reads are RLS-scoped, writes
-- go through a SECURITY DEFINER command" split every other
-- member-writable table in this schema already uses (scene_positions,
-- clocks, characters).

-- ── schema: encounter_monsters ──────────────────────────────────────
-- Ephemeral by design (decision #2): deleted by end_encounter once it
-- writes the journal summary, so this never accumulates dead rows
-- between fights. `stat_block` reuses the exact ac/hp_max/hp_current/
-- attacks/notes shape `npcs.stat_block` already established (hirelings'
-- shape), plus one addition this feature needs that npcs never did:
-- `dex_mod`, since initiative (pg. 83) explicitly requires "the DEX
-- modifier of the monster with the highest DEX bonus" and nothing in
-- the existing shape carried a numeric DEX anywhere.
--
-- `visible_to_players`/`hp_visible_to_players` are two independent
-- toggles per the scope doc's `MonsterCard` note. Both are RLS-real for
-- presence (a hidden monster's row is genuinely invisible to a player,
-- same as `clocks.revealed`) -- but HP-visibility is a client-side
-- rendering gate only, same documented limitation Delve's attempt 1
-- already ran into and named honestly (`delve-master-task-list.md`,
-- Phase 3's monster HP-visibility entry): Postgres has no column-level
-- RLS, so a visible-but-HP-hidden monster's `stat_block` (HP included)
-- is still present in whatever the client fetches, just not meant to be
-- rendered. Full masking would need a security-definer view; not built
-- speculatively for a phase-1 data layer with no UI yet to gate.
create table encounter_monsters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  label text not null,
  stat_block jsonb not null default '{}'::jsonb,
  zone text not null default 'near' check (zone in ('close', 'near', 'far')),
  visible_to_players boolean not null default false,
  hp_visible_to_players boolean not null default false,
  created_at timestamptz not null default now()
);

create index encounter_monsters_campaign_idx on encounter_monsters (campaign_id);

alter table encounter_monsters enable row level security;

create policy encounter_monsters_select_member on encounter_monsters for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = encounter_monsters.campaign_id
      and campaign_members.user_id = auth.uid()
      and (encounter_monsters.visible_to_players = true or campaign_members.role = 'owner')
  ));

-- ── schema: turn_order ───────────────────────────────────────────────
-- One row per campaign (`campaign_id` is the primary key, not a
-- separate `id` -- there is never more than one active encounter's
-- worth of turn order per campaign at a time). `combatants` is a real,
-- ordered jsonb array of `{combatant_type, combatant_id, label,
-- initiative_roll, acted, moved}` objects -- Delve's own
-- `delve-path-forward.md` flagged its equivalent jsonb-blob turn_order
-- as a debt with "no initiative-roll command"; this one is written
-- exclusively by `roll_initiative`/`advance_turn` below, never
-- hand-edited, so the blob shape is a deliberate, controlled choice
-- here rather than an accidental one. No secret-vs-visible split like
-- `encounter_monsters` -- who's in what order isn't GM-only
-- information at a real table.
create table turn_order (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  combatants jsonb not null default '[]'::jsonb,
  active_index int not null default 0,
  round_number int not null default 1,
  started_at timestamptz
);

alter table turn_order enable row level security;

create policy turn_order_select_member on turn_order for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = turn_order.campaign_id
      and campaign_members.user_id = auth.uid()
  ));

-- ── commands ─────────────────────────────────────────────────────────
-- All seven GM-only (`role = 'owner'`), matching the scope doc's own
-- framing of this whole feature as GM-facing (`EncounterControls`'
-- doc comment). Every mutation logs to campaign_events; journal_entries
-- (which `session_id not null` requires an open session for) is only
-- written by end_encounter, and only when a session is actually open --
-- same optional-p_session_id convention adjust_character_hp/
-- set_character_hp_max already use.

create or replace function start_encounter(p_campaign_id uuid)
returns turn_order
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_turn turn_order;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can start an encounter';
  end if;

  insert into turn_order (campaign_id, combatants, active_index, round_number, started_at)
  values (p_campaign_id, '[]'::jsonb, 0, 1, now())
  on conflict (campaign_id) do update
    set combatants = '[]'::jsonb, active_index = 0, round_number = 1, started_at = now()
  returning * into v_turn;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'encounter_started', '{}'::jsonb);

  return v_turn;
end;
$$;

grant execute on function start_encounter(uuid) to authenticated;
revoke execute on function start_encounter(uuid) from public;
revoke execute on function start_encounter(uuid) from anon;

create or replace function add_encounter_monster(
  p_campaign_id uuid,
  p_label text,
  p_stat_block jsonb default '{}'::jsonb,
  p_zone text default 'near'
)
returns encounter_monsters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_monster encounter_monsters;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_zone not in ('close', 'near', 'far') then
    raise exception 'invalid zone: %', p_zone;
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can add a monster';
  end if;

  insert into encounter_monsters (campaign_id, label, stat_block, zone)
  values (p_campaign_id, p_label, p_stat_block, p_zone)
  returning * into v_monster;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'encounter_monster_added', jsonb_build_object('monster_id', v_monster.id, 'label', v_monster.label));

  return v_monster;
end;
$$;

grant execute on function add_encounter_monster(uuid, text, jsonb, text) to authenticated;
revoke execute on function add_encounter_monster(uuid, text, jsonb, text) from public;
revoke execute on function add_encounter_monster(uuid, text, jsonb, text) from anon;

-- Mirrors adjust_character_hp's shape exactly (0009_character_commands.sql):
-- floors at 0, ceilings at stat_block's own hp_max, no free healing past
-- max. Requires hp_max to already be set (> 0) -- a monster added without
-- one hasn't had its HP tracked yet, and silently clamping to a 0 max
-- would read as "instantly killed" for what's really "not set up yet".
create or replace function damage_encounter_monster(p_monster_id uuid, p_delta int)
returns encounter_monsters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_monster encounter_monsters;
  v_hp_max int;
  v_hp_current int;
  v_new_hp int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_monster from encounter_monsters where id = p_monster_id for update;
  if not found then
    raise exception 'monster not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_monster.campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can damage a monster';
  end if;

  v_hp_max := coalesce((v_monster.stat_block ->> 'hp_max')::int, 0);
  if v_hp_max <= 0 then
    raise exception 'monster has no hp_max set';
  end if;
  v_hp_current := coalesce((v_monster.stat_block ->> 'hp_current')::int, v_hp_max);
  v_new_hp := greatest(0, least(v_hp_max, v_hp_current + p_delta));

  update encounter_monsters
  set stat_block = jsonb_set(stat_block, '{hp_current}', to_jsonb(v_new_hp))
  where id = p_monster_id
  returning * into v_monster;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_monster.campaign_id, v_uid, 'encounter_monster_damaged',
    jsonb_build_object('monster_id', v_monster.id, 'label', v_monster.label, 'from', v_hp_current, 'to', v_new_hp)
  );

  return v_monster;
end;
$$;

grant execute on function damage_encounter_monster(uuid, int) to authenticated;
revoke execute on function damage_encounter_monster(uuid, int) from public;
revoke execute on function damage_encounter_monster(uuid, int) from anon;

-- Either flag can be set independently -- passing null for one leaves
-- it unchanged (`coalesce`), so the frontend can flip just one toggle
-- without re-sending the other's current value.
create or replace function set_monster_visibility(
  p_monster_id uuid,
  p_visible_to_players boolean default null,
  p_hp_visible_to_players boolean default null
)
returns encounter_monsters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_monster encounter_monsters;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_monster from encounter_monsters where id = p_monster_id for update;
  if not found then
    raise exception 'monster not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_monster.campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can change monster visibility';
  end if;

  update encounter_monsters
  set visible_to_players = coalesce(p_visible_to_players, visible_to_players),
      hp_visible_to_players = coalesce(p_hp_visible_to_players, hp_visible_to_players)
  where id = p_monster_id
  returning * into v_monster;

  return v_monster;
end;
$$;

grant execute on function set_monster_visibility(uuid, boolean, boolean) to authenticated;
revoke execute on function set_monster_visibility(uuid, boolean, boolean) from public;
revoke execute on function set_monster_visibility(uuid, boolean, boolean) from anon;

-- Every active character in the campaign rolls individually (1d20 +
-- their own DEX mod, read from `characters.abilities->'dex'->>'mod'`).
-- Every monster present shares ONE roll (1d20 + the highest `dex_mod`
-- among them) per the rulebook's explicit "GM uses the DEX modifier of
-- the monster with the highest DEX bonus" (pg. 83) -- monsters still
-- get their own combatant entries (so each can be damaged/acted on
-- individually later), they just land together in sorted order since
-- they share the identical initiative_roll value, matching how a GM
-- actually resolves "the monsters' turn" as one block at the table.
-- Re-rollable: calling this again (e.g. after a surprise round, or a
-- GM restart) fully replaces the prior combatants/round/index.
create or replace function roll_initiative(p_campaign_id uuid)
returns turn_order
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_char record;
  v_combatants jsonb := '[]'::jsonb;
  v_monster_combatants jsonb;
  v_max_monster_dex int;
  v_monster_roll int;
  v_sorted jsonb;
  v_turn turn_order;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can roll initiative';
  end if;

  for v_char in
    select id, name, coalesce((abilities -> 'dex' ->> 'mod')::int, 0) as dex_mod
    from characters
    where campaign_id = p_campaign_id and status = 'active'
  loop
    v_combatants := v_combatants || jsonb_build_object(
      'combatant_type', 'character',
      'combatant_id', v_char.id,
      'label', v_char.name,
      'initiative_roll', (1 + floor(random() * 20)::int) + v_char.dex_mod,
      'acted', false,
      'moved', false
    );
  end loop;

  select max(coalesce((stat_block ->> 'dex_mod')::int, 0)) into v_max_monster_dex
  from encounter_monsters where campaign_id = p_campaign_id;

  if v_max_monster_dex is not null then
    v_monster_roll := (1 + floor(random() * 20)::int) + v_max_monster_dex;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'combatant_type', 'monster',
        'combatant_id', em.id,
        'label', em.label,
        'initiative_roll', v_monster_roll,
        'acted', false,
        'moved', false
      ) order by em.created_at
    ), '[]'::jsonb) into v_monster_combatants
    from encounter_monsters em
    where em.campaign_id = p_campaign_id;

    v_combatants := v_combatants || v_monster_combatants;
  end if;

  if jsonb_array_length(v_combatants) = 0 then
    raise exception 'no characters or monsters to roll initiative for';
  end if;

  select coalesce(jsonb_agg(elem order by (elem ->> 'initiative_roll')::int desc), '[]'::jsonb)
  into v_sorted
  from jsonb_array_elements(v_combatants) elem;

  insert into turn_order (campaign_id, combatants, active_index, round_number, started_at)
  values (p_campaign_id, v_sorted, 0, 1, now())
  on conflict (campaign_id) do update
    set combatants = excluded.combatants, active_index = 0, round_number = 1, started_at = excluded.started_at
  returning * into v_turn;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'initiative_rolled', jsonb_build_object('combatant_count', jsonb_array_length(v_sorted)));

  return v_turn;
end;
$$;

grant execute on function roll_initiative(uuid) to authenticated;
revoke execute on function roll_initiative(uuid) from public;
revoke execute on function roll_initiative(uuid) from anon;

-- Clockwise rotation without re-sorting (same shape Delve's own
-- advanceTurn used) -- wraps to index 0 and bumps round_number when it
-- runs off the end. The combatant becoming active gets its acted/moved
-- flags reset to false; every other combatant's flags are left alone
-- (Delve's attempt reset the whole array on rotation -- resetting only
-- the newly-active entry is enough, since moved/acted are meaningless
-- for a combatant who isn't up yet).
create or replace function advance_turn(p_campaign_id uuid)
returns turn_order
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_turn turn_order;
  v_count int;
  v_next_index int;
  v_new_round boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_turn from turn_order where campaign_id = p_campaign_id for update;
  if not found then
    raise exception 'no active encounter';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can advance the turn';
  end if;

  v_count := jsonb_array_length(v_turn.combatants);
  if v_count = 0 then
    raise exception 'no combatants in turn order';
  end if;

  v_next_index := v_turn.active_index + 1;
  if v_next_index >= v_count then
    v_next_index := 0;
    v_new_round := true;
  end if;

  update turn_order
  set active_index = v_next_index,
      round_number = round_number + (case when v_new_round then 1 else 0 end),
      combatants = jsonb_set(
        jsonb_set(combatants, array[v_next_index::text, 'acted'], 'false'::jsonb),
        array[v_next_index::text, 'moved'], 'false'::jsonb
      )
  where campaign_id = p_campaign_id
  returning * into v_turn;

  return v_turn;
end;
$$;

grant execute on function advance_turn(uuid) to authenticated;
revoke execute on function advance_turn(uuid) from public;
revoke execute on function advance_turn(uuid) from anon;

-- Per decision #2: logs a short journal-feed system entry summarizing
-- the fight (same pattern as the session-recap entry from phase 17),
-- then deletes the encounter_monsters rows -- ephemeral by design.
-- `p_session_id` is optional, matching every other command's convention:
-- journal_entries.session_id is NOT NULL, so the summary is only
-- written when a session is actually open; campaign_events (which has
-- no such requirement) is always written regardless.
create or replace function end_encounter(p_campaign_id uuid, p_session_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_monster record;
  v_parts text[] := '{}';
  v_round int;
  v_monster_count int;
  v_body text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can end an encounter';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = p_campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  select round_number into v_round from turn_order where campaign_id = p_campaign_id;
  select count(*) into v_monster_count from encounter_monsters where campaign_id = p_campaign_id;

  for v_monster in
    select
      label,
      (stat_block ->> 'hp_current')::int as hp_current,
      (stat_block ->> 'hp_max')::int as hp_max
    from encounter_monsters
    where campaign_id = p_campaign_id
    order by created_at
  loop
    if v_monster.hp_current is not null and v_monster.hp_current <= 0 then
      v_parts := v_parts || (v_monster.label || ' (defeated)');
    elsif v_monster.hp_current is not null and v_monster.hp_max is not null then
      v_parts := v_parts || (v_monster.label || ' (' || v_monster.hp_current || '/' || v_monster.hp_max || ' HP)');
    else
      v_parts := v_parts || v_monster.label;
    end if;
  end loop;

  v_body := 'Encounter ended';
  if v_round is not null then
    v_body := v_body || ' after ' || v_round || ' round' || (case when v_round = 1 then '' else 's' end);
  end if;
  if coalesce(array_length(v_parts, 1), 0) > 0 then
    v_body := v_body || ' — ' || array_to_string(v_parts, ', ');
  end if;

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (p_campaign_id, p_session_id, v_uid, 'system', v_body, 'Encounter', null);
  end if;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'encounter_ended',
    jsonb_build_object('round', v_round, 'monster_count', v_monster_count)
  );

  delete from encounter_monsters where campaign_id = p_campaign_id;
  delete from turn_order where campaign_id = p_campaign_id;
end;
$$;

grant execute on function end_encounter(uuid, uuid) to authenticated;
revoke execute on function end_encounter(uuid, uuid) from public;
revoke execute on function end_encounter(uuid, uuid) from anon;
