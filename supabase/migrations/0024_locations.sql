-- 0024_locations.sql
-- Locations/Places tracker (BUILD_PLAN.md item 15, "GM prep + handouts",
-- slice 1 of 4 -- scope doc: grimoire-phase15-gm-prep-handouts-scope.md).
-- Mirrors npcs/npc_stat_blocks exactly: `locations` is member-visible
-- (the player-known summary), `location_secrets` is a GM-only companion
-- table -- RLS-enforced at the table level, same reason npc_stat_blocks
-- needed a real split rather than a client-side "just don't render it"
-- trick (RLS is row-level, not column-level).
--
-- Replaces `_CAMPAIGNS/The Black Road/world.md`, which had no in-app
-- equivalent despite every other campaign tracker file already having
-- one (quest-log.md -> quests, npc-log.md -> npcs, tracker.xlsx ->
-- factions/treasure). Read-only from the app, same as
-- npcs/factions/treasure/campaign_notes today (BUILD_PLAN item 9's own
-- scoping call: "surface the already-imported tables," not full CRUD)
-- -- no INSERT/UPDATE/DELETE policies here either.

create table locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  kind text not null default 'site' check (kind in ('settlement', 'region', 'site')),
  status text,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create table location_secrets (
  location_id uuid primary key references locations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table locations enable row level security;
alter table location_secrets enable row level security;

create policy locations_select_member on locations for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = locations.campaign_id
      and campaign_members.user_id = auth.uid()
  ));

create policy location_secrets_select_gm on location_secrets for select
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = location_secrets.campaign_id
      and campaign_members.user_id = auth.uid()
      and campaign_members.role = 'owner'
  ));

-- Real import from world.md (The Black Road, the one live campaign) --
-- same "seed real data, not placeholder rows" precedent as
-- black_road_npcs/black_road_factions_quests_treasure. Dreg's Ford has
-- no "Hidden:" section in world.md, so it gets no location_secrets row
-- -- same "not every NPC has a stat block" shape npcs/npc_stat_blocks
-- already has.
insert into locations (campaign_id, name, kind, status, summary) values
  ('d20f78a5-20c7-4d27-9d47-b3d8c075b128', 'Dreg''s Ford', 'settlement', 'Visited',
   'Small fortified border settlement at the edge of the Gloaming. Courier Orren Vey is missing after entering the Black Road. Visited: The Bent Nail. Known but unvisited: Reeve''s Hall, The Crooked Buckle, Nella Fen''s Remedies, Latch & Ledger, Shrine of the Nine, North Palisade.'),
  ('d20f78a5-20c7-4d27-9d47-b3d8c075b128', 'The Gloaming', 'region', 'Starting settlement only explored',
   'Ancient forest beyond Dreg''s Ford.'),
  ('d20f78a5-20c7-4d27-9d47-b3d8c075b128', 'The Black Road', 'site', 'Known entrance; not entered',
   'Known entrance; not entered. Orren Vey vanished after taking this route.');

insert into location_secrets (location_id, campaign_id, notes)
select id, campaign_id, 'All keyed hex contents and unexplored map information.'
from locations where name = 'The Gloaming' and campaign_id = 'd20f78a5-20c7-4d27-9d47-b3d8c075b128';

insert into location_secrets (location_id, campaign_id, notes)
select id, campaign_id, 'Route, destinations, encounters, hazards, and locations.'
from locations where name = 'The Black Road' and campaign_id = 'd20f78a5-20c7-4d27-9d47-b3d8c075b128';
