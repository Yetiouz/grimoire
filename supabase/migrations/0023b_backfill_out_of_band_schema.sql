-- 0023b: backfill DDL that was applied out-of-band (CI rescue, 2026-08-15).
--
-- Five tables and six commands existed in the LIVE database with no
-- migration file creating them: campaign_maps, campaign_map_markers,
-- campaign_map_position, campaign_notes, npc_stat_blocks, and the map
-- command functions. Later migrations (0024, 0026, 0029) reference
-- them, so every clean rebuild — including CI's verify-db job — died at
-- 0026 with 'relation "campaign_maps" does not exist'. This file
-- records the live schema verbatim (dumped from pg_catalog, not
-- reconstructed from memory) at the point BEFORE 0026's alter, and is
-- numbered 0023b so it sorts after 0023 and before the first reference
-- in 0024.
--
-- Everything here is idempotent (IF NOT EXISTS / OR REPLACE / DROP
-- POLICY IF EXISTS) so applying it against the live database — where
-- these objects already exist — is a no-op that keeps the migration
-- history linear.
--
-- The lesson this file exists to record: DDL applied straight to the
-- dashboard without a migration file breaks every future rebuild.
-- CLAUDE.md already says "every schema change is a numbered migration";
-- this was the cost of the exceptions.

-- ── tables ───────────────────────────────────────────────────────────

create table if not exists campaign_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null check (kind in ('region', 'site', 'scene')),
  label text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- handout_storage_path deliberately absent: 0026 adds it.
);

create index if not exists campaign_maps_campaign_id_idx
  on campaign_maps (campaign_id);
create unique index if not exists campaign_maps_campaign_kind_idx
  on campaign_maps (campaign_id, kind);

create table if not exists campaign_map_markers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null check (kind in ('region', 'site')),
  marker_kind text not null default 'poi'
    check (marker_kind in ('poi', 'npc', 'danger', 'custom')),
  label text not null,
  x numeric not null check (x >= 0 and x <= 100),
  y numeric not null check (y >= 0 and y <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_map_markers_campaign_kind_idx
  on campaign_map_markers (campaign_id, kind);

create table if not exists campaign_map_position (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  x numeric check (x >= 0 and x <= 100),
  y numeric check (y >= 0 and y <= 100),
  location_label text,
  travel_pace text,
  hexes_remaining integer check (hexes_remaining >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists npc_stat_blocks (
  npc_id uuid primary key references npcs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  stat_block jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────

alter table campaign_maps enable row level security;
alter table campaign_map_markers enable row level security;
alter table campaign_map_position enable row level security;
alter table campaign_notes enable row level security;
alter table npc_stat_blocks enable row level security;

drop policy if exists "campaign_maps_select_member" on campaign_maps;
create policy "campaign_maps_select_member" on campaign_maps for select
  using (exists (select 1 from campaign_members
    where campaign_members.campaign_id = campaign_maps.campaign_id
      and campaign_members.user_id = auth.uid()));

drop policy if exists "campaign_map_markers_select_member" on campaign_map_markers;
create policy "campaign_map_markers_select_member" on campaign_map_markers for select
  using (exists (select 1 from campaign_members
    where campaign_members.campaign_id = campaign_map_markers.campaign_id
      and campaign_members.user_id = auth.uid()));

drop policy if exists "campaign_map_position_select_member" on campaign_map_position;
create policy "campaign_map_position_select_member" on campaign_map_position for select
  using (exists (select 1 from campaign_members
    where campaign_members.campaign_id = campaign_map_position.campaign_id
      and campaign_members.user_id = auth.uid()));

drop policy if exists "campaign_notes_select_member" on campaign_notes;
create policy "campaign_notes_select_member" on campaign_notes for select
  using (exists (select 1 from campaign_members
    where campaign_members.campaign_id = campaign_notes.campaign_id
      and campaign_members.user_id = auth.uid()));

-- GM-only read: stat blocks are secrets, owner-scoped.
drop policy if exists "npc_stat_blocks_select_gm" on npc_stat_blocks;
create policy "npc_stat_blocks_select_gm" on npc_stat_blocks for select
  using (exists (select 1 from campaign_members
    where campaign_members.campaign_id = npc_stat_blocks.campaign_id
      and campaign_members.user_id = auth.uid()
      and campaign_members.role = 'owner'));

-- ── map commands (verbatim from the live database) ──────────────────

create or replace function public.set_campaign_map(p_campaign_id uuid, p_kind text, p_label text, p_storage_path text)
 returns campaign_maps
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_map campaign_maps;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_kind not in ('region', 'site', 'scene') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  insert into campaign_maps (campaign_id, kind, label, storage_path)
  values (p_campaign_id, p_kind, p_label, p_storage_path)
  on conflict (campaign_id, kind)
  do update set label = excluded.label, storage_path = excluded.storage_path, updated_at = now()
  returning * into v_map;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'campaign_map_set',
    jsonb_build_object('map_id', v_map.id, 'kind', p_kind, 'label', p_label)
  );

  return v_map;
end;
$function$;

create or replace function public.clear_campaign_map(p_campaign_id uuid, p_kind text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  delete from campaign_maps where campaign_id = p_campaign_id and kind = p_kind;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'campaign_map_cleared', jsonb_build_object('kind', p_kind));
end;
$function$;

create or replace function public.add_map_marker(p_campaign_id uuid, p_kind text, p_label text, p_x numeric, p_y numeric, p_marker_kind text default 'poi', p_notes text default null)
 returns campaign_map_markers
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_marker campaign_map_markers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_kind not in ('region', 'site') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  if p_marker_kind not in ('poi', 'npc', 'danger', 'custom') then
    raise exception 'invalid marker_kind: %', p_marker_kind;
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  insert into campaign_map_markers (campaign_id, kind, label, x, y, marker_kind, notes)
  values (p_campaign_id, p_kind, p_label, p_x, p_y, p_marker_kind, p_notes)
  returning * into v_marker;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'map_marker_added',
    jsonb_build_object('marker_id', v_marker.id, 'kind', p_kind, 'label', p_label)
  );

  return v_marker;
end;
$function$;

create or replace function public.remove_map_marker(p_marker_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_label text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select m.campaign_id, m.label into v_campaign_id, v_label
  from campaign_map_markers m
  join campaign_members cm on cm.campaign_id = m.campaign_id
  where m.id = p_marker_id and cm.user_id = v_uid;

  if v_campaign_id is null then
    raise exception 'marker not found or not a member of its campaign';
  end if;

  delete from campaign_map_markers where id = p_marker_id;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (v_campaign_id, v_uid, 'map_marker_removed', jsonb_build_object('marker_id', p_marker_id, 'label', v_label));
end;
$function$;

create or replace function public.update_map_marker(p_marker_id uuid, p_label text default null, p_x numeric default null, p_y numeric default null, p_marker_kind text default null, p_notes text default null)
 returns campaign_map_markers
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_marker campaign_map_markers;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_marker_kind is not null and p_marker_kind not in ('poi', 'npc', 'danger', 'custom') then
    raise exception 'invalid marker_kind: %', p_marker_kind;
  end if;

  if not exists (
    select 1 from campaign_map_markers m
    join campaign_members cm on cm.campaign_id = m.campaign_id
    where m.id = p_marker_id and cm.user_id = v_uid
  ) then
    raise exception 'marker not found or not a member of its campaign';
  end if;

  update campaign_map_markers set
    label = coalesce(p_label, label),
    x = coalesce(p_x, x),
    y = coalesce(p_y, y),
    marker_kind = coalesce(p_marker_kind, marker_kind),
    notes = coalesce(p_notes, notes),
    updated_at = now()
  where id = p_marker_id
  returning * into v_marker;

  return v_marker;
end;
$function$;

create or replace function public.set_party_position(p_campaign_id uuid, p_x numeric default null, p_y numeric default null, p_location_label text default null, p_travel_pace text default null, p_hexes_remaining integer default null, p_clear_pin boolean default false)
 returns campaign_map_position
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_pos campaign_map_position;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  insert into campaign_map_position (campaign_id, x, y, location_label, travel_pace, hexes_remaining)
  values (p_campaign_id, p_x, p_y, p_location_label, p_travel_pace, p_hexes_remaining)
  on conflict (campaign_id) do update set
    x = case when p_clear_pin then null else coalesce(p_x, campaign_map_position.x) end,
    y = case when p_clear_pin then null else coalesce(p_y, campaign_map_position.y) end,
    location_label = coalesce(p_location_label, campaign_map_position.location_label),
    travel_pace = coalesce(p_travel_pace, campaign_map_position.travel_pace),
    hexes_remaining = coalesce(p_hexes_remaining, campaign_map_position.hexes_remaining),
    updated_at = now()
  returning * into v_pos;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'party_position_updated',
    jsonb_build_object('location_label', v_pos.location_label, 'hexes_remaining', v_pos.hexes_remaining)
  );

  return v_pos;
end;
$function$;
