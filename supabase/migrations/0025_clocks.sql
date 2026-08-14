-- 0025_clocks.sql
-- Threat/faction clocks (BUILD_PLAN.md item 15, "GM prep + handouts",
-- slice 2 of 4 -- scope doc: grimoire-phase15-gm-prep-handouts-scope.md).
--
-- Unlike every other WorldTabs table so far (npcs/factions/treasure/
-- campaign_notes/locations -- all read-only from the app, seeded once
-- via migration), clocks are meant to change session-to-session:
-- SESSION_PROTOCOL.md step 2 has the GM reviewing and advancing them
-- every session, then hand-updating tracker.xlsx's "Current Status/
-- Clock" column afterward. This is the first WorldTabs table with
-- real in-app mutation -- but mutation here follows the app's existing
-- convention for writes (adjust_character_hp/set_campaign_map/
-- ensure_campaign_join_code): no INSERT/UPDATE/DELETE RLS policy on
-- the table itself, only SECURITY DEFINER RPC functions below that
-- check `campaign_members.role = 'owner'` internally and log to
-- campaign_events, same as those three.
--
-- `revealed` (owner's call, 2026-08-14 scoping question): threat clocks
-- default to GM-only, matching this campaign's "full fog of war"
-- settings and the npcs/npc_stat_blocks + locations/location_secrets
-- GM-only-content precedent -- a clock only becomes member-visible once
-- the GM flips it, rather than always being a visible tension meter.
-- One table with a boolean, not a base/secret table split like those
-- two: there's no separate "player-safe summary" text for a clock the
-- way an NPC or location has one, just a single row that's either
-- shown whole or not shown at all.
--
-- `faction_id` is nullable: SESSION_PROTOCOL.md's "faction/threat
-- clocks" covers both faction-tied pressure (this migration's seed
-- example) and freestanding threats/countdowns not attached to any one
-- faction (a rumor, an oath, an environmental hazard).

create table clocks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  faction_id uuid references factions(id) on delete set null,
  name text not null,
  description text not null default '',
  segments int not null check (segments > 0),
  filled int not null default 0 check (filled >= 0 and filled <= segments),
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clocks enable row level security;

create policy clocks_select_member on clocks for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = clocks.campaign_id
      and campaign_members.user_id = auth.uid()
      and (clocks.revealed = true or campaign_members.role = 'owner')
  ));

create or replace function create_clock(
  p_campaign_id uuid,
  p_name text,
  p_segments int,
  p_description text default '',
  p_faction_id uuid default null
)
returns clocks
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_clock clocks;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can create a clock';
  end if;

  if p_faction_id is not null and not exists (
    select 1 from factions where id = p_faction_id and campaign_id = p_campaign_id
  ) then
    raise exception 'faction does not belong to this campaign';
  end if;

  insert into clocks (campaign_id, faction_id, name, description, segments)
  values (p_campaign_id, p_faction_id, p_name, p_description, p_segments)
  returning * into v_clock;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'clock_created', jsonb_build_object('clock_id', v_clock.id, 'name', v_clock.name));

  return v_clock;
end;
$$;

create or replace function update_clock(
  p_clock_id uuid,
  p_name text,
  p_description text,
  p_segments int,
  p_faction_id uuid,
  p_revealed boolean
)
returns clocks
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_clock clocks;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_clock from clocks where id = p_clock_id for update;
  if not found then
    raise exception 'clock not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_clock.campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can edit a clock';
  end if;

  if p_faction_id is not null and not exists (
    select 1 from factions where id = p_faction_id and campaign_id = v_clock.campaign_id
  ) then
    raise exception 'faction does not belong to this campaign';
  end if;

  update clocks
  set name = p_name,
      description = p_description,
      segments = p_segments,
      faction_id = p_faction_id,
      revealed = p_revealed,
      filled = least(filled, p_segments),
      updated_at = now()
  where id = p_clock_id
  returning * into v_clock;

  return v_clock;
end;
$$;

create or replace function adjust_clock(p_clock_id uuid, p_delta int)
returns clocks
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_clock clocks;
  v_old_filled int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_clock from clocks where id = p_clock_id for update;
  if not found then
    raise exception 'clock not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_clock.campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can advance a clock';
  end if;

  v_old_filled := v_clock.filled;

  update clocks
  set filled = greatest(0, least(v_clock.segments, v_clock.filled + p_delta)),
      updated_at = now()
  where id = p_clock_id
  returning * into v_clock;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_clock.campaign_id, v_uid, 'clock_advanced',
    jsonb_build_object('clock_id', v_clock.id, 'name', v_clock.name, 'from', v_old_filled, 'to', v_clock.filled)
  );

  return v_clock;
end;
$$;

create or replace function delete_clock(p_clock_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_clock clocks;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_clock from clocks where id = p_clock_id;
  if not found then
    raise exception 'clock not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_clock.campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can delete a clock';
  end if;

  delete from clocks where id = p_clock_id;
end;
$$;

-- Real seed: the one clearly-evidenced active threat in the live
-- campaign (campaign-state.md's "Next pickup" narrative + the
-- `factions` row itself) -- Varek Skane's rite. tracker.xlsx's other
-- faction ("Dreg's Ford Reeve's Office") explicitly has "No clock
-- established," so it gets none here -- same "don't invent placeholder
-- rows" precedent as 0024_locations.sql.
insert into clocks (campaign_id, faction_id, name, description, segments, filled, revealed)
select
  'd20f78a5-20c7-4d27-9d47-b3d8c075b128',
  factions.id,
  'Varek''s Rite to Awaken the Black Hart',
  'Captain Varek Skane ("the Castellan") needs Road''s Memory (the cursed sword) and the Hartguard Gorget to perform a rite awakening the Black Hart knights entombed beneath Drowned Bell Weir. Maela Rusk ("Rook") and Dren Tal ("the Ferryman") are captured; Varek''s own location and remaining strength are unconfirmed.',
  6, 0, false
from factions
where factions.campaign_id = 'd20f78a5-20c7-4d27-9d47-b3d8c075b128'
  and factions.name = 'Order of the Black Hart';
