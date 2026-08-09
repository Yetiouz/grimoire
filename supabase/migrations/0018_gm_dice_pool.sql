-- 0018: the GM's dice pool (SLICE_17_SPEC.md, decision 4 + integrity).
--
-- Dice for rolls the player never touches (monster attacks, morale,
-- reactions) are pre-generated per turn in Postgres and consumed in
-- strict order: the consume function only ever hands out the NEXT
-- unconsumed value for a die type. There is no API to peek ahead, skip,
-- or re-draw — the GM cannot reroll what it doesn't like, structurally.
-- Pools are cheap rows, created at turn start by the edge function on
-- the caller's JWT, orphaned harmlessly if a turn dies.

create table gm_dice_pools (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table gm_pool_dice (
  pool_id uuid not null references gm_dice_pools(id) on delete cascade,
  die text not null,
  seq integer not null,
  value integer not null,
  consumed_at timestamptz,
  primary key (pool_id, die, seq)
);

alter table gm_dice_pools enable row level security;
alter table gm_pool_dice enable row level security;
-- No policies on either: access only through the functions below.
-- Values must not be readable ahead of consumption — a peekable pool
-- is a fudgeable pool.

create or replace function gm_create_dice_pool(p_campaign_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $grim$
declare
  v_pool uuid;
  v_die text;
  v_sides integer;
  v_seq integer;
begin
  if not gm_check_is_member(p_campaign_id) then
    raise exception 'not a member of this campaign';
  end if;
  insert into gm_dice_pools (campaign_id) values (p_campaign_id)
  returning id into v_pool;
  for v_die, v_sides in
    select * from (values ('d4',4),('d6',6),('d8',8),('d10',10),('d12',12),('d20',20),('d100',100)) as t
  loop
    for v_seq in 1..12 loop
      insert into gm_pool_dice (pool_id, die, seq, value)
      values (v_pool, v_die, v_seq, floor(random() * v_sides)::int + 1);
    end loop;
  end loop;
  return v_pool;
end;
$grim$;

-- Hands out the next value for a die type, in order, exactly once.
create or replace function gm_consume_die(p_pool_id uuid, p_die text)
returns jsonb
language plpgsql security definer set search_path = public as $grim$
declare
  v_campaign uuid;
  v_seq integer;
  v_value integer;
begin
  select campaign_id into v_campaign from gm_dice_pools where id = p_pool_id;
  if v_campaign is null then raise exception 'no such pool'; end if;
  if not gm_check_is_member(v_campaign) then
    raise exception 'not a member of this campaign';
  end if;
  select seq, value into v_seq, v_value
  from gm_pool_dice
  where pool_id = p_pool_id and die = p_die and consumed_at is null
  order by seq
  limit 1
  for update skip locked;
  if v_seq is null then
    raise exception 'pool exhausted for %', p_die;
  end if;
  update gm_pool_dice set consumed_at = now()
  where pool_id = p_pool_id and die = p_die and seq = v_seq;
  return jsonb_build_object('die', p_die, 'seq', v_seq, 'value', v_value);
end;
$grim$;
