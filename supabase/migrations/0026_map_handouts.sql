-- 0026_map_handouts.sql
-- Player-safe handout maps (BUILD_PLAN.md item 15, "GM prep + handouts",
-- slice 4 of 4 -- scope doc: grimoire-phase15-gm-prep-handouts-scope.md).
--
-- The real campaign already has a distinct, prettier, player-facing
-- version of the Dreg's Ford site map (maps/dregs-ford-player-map-
-- illustrated-v1.png), separate from the GM's own working map -- no
-- in-app equivalent existed. `campaign_maps` gets one new nullable
-- column rather than a second table: a handout is a variant of an
-- existing map row, not a new kind of thing, and it's optional (most
-- maps won't have one).
--
-- Access split, per the owner's 2026-08-14 scoping call: unlike every
-- other write in this table's own convention so far (set_campaign_map/
-- clear_campaign_map check membership only -- "no GM-only tier exists
-- anywhere in this app's command layer" was accurate up through slice 8,
-- ANY member could upload or replace the working map), setting or
-- clearing the HANDOUT specifically is owner-only. This is the first
-- owner-only gate in the maps command layer -- the working-map upload/
-- replace/delete path above is completely untouched by this migration,
-- still open to any member exactly as before. The distinction only
-- makes sense for the piece a GM actually curates for players.
--
-- Note on what this is (and isn't): the SELECT policy below stays
-- member-scoped, same as it already was -- a handout is a nicer image
-- to show players by default, not a secret one gated by RLS the way
-- npc_stat_blocks/location_secrets are. Any member could still fetch a
-- signed URL for the *working* image directly if they went looking for
-- it (same as today, unchanged). The client-side "players see the
-- handout, the GM sees their own working map" swap (MapsRegionTab/
-- MapsSiteTab) is a display default, not an access control boundary --
-- worth being honest about rather than implying a security guarantee
-- this migration doesn't actually add.

alter table campaign_maps add column handout_storage_path text;

create or replace function set_map_handout(
  p_campaign_id uuid,
  p_kind text,
  p_storage_path text
)
returns campaign_maps
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_map campaign_maps;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can set a handout map';
  end if;

  select * into v_map from campaign_maps where campaign_id = p_campaign_id and kind = p_kind for update;
  if not found then
    raise exception 'no % map to attach a handout to -- upload the working map first', p_kind;
  end if;

  update campaign_maps
  set handout_storage_path = p_storage_path,
      updated_at = now()
  where campaign_id = p_campaign_id and kind = p_kind
  returning * into v_map;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'map_handout_set', jsonb_build_object('map_id', v_map.id, 'kind', p_kind));

  return v_map;
end;
$$;

create or replace function clear_map_handout(p_campaign_id uuid, p_kind text)
returns campaign_maps
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_map campaign_maps;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the campaign owner can clear a handout map';
  end if;

  select * into v_map from campaign_maps where campaign_id = p_campaign_id and kind = p_kind for update;
  if not found then
    raise exception 'map not found';
  end if;

  update campaign_maps
  set handout_storage_path = null,
      updated_at = now()
  where campaign_id = p_campaign_id and kind = p_kind
  returning * into v_map;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (p_campaign_id, v_uid, 'map_handout_cleared', jsonb_build_object('map_id', v_map.id, 'kind', p_kind));

  return v_map;
end;
$$;
