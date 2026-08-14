-- 0029_scene_positions.sql
-- BUILD_PLAN item 8's remaining gap: the Scene tab has been an honest,
-- labeled stub ("Scene (coming soon)") since the Maps overlay first
-- shipped -- Close/Near/Far zone positioning was deliberately deferred
-- to land together with Encounter mode (item 13, unbuilt). Owner's call
-- (2026-08-14, asked directly): item 13 is a much bigger lift than this
-- gap alone, so this ships a standalone zone tracker now -- independent
-- of initiative/monster cards/HP toggles -- rather than waiting. Same
-- "real, usable today; a later slice can extend it" reasoning
-- `useCampaignPresence` already used for item 14's online dot vs. full
-- cursor/typing presence.
--
-- Deliberately its own table, not folded into `campaign_map_position`
-- (which already exists for Region/Site travel tracking) -- that table
-- is one row per campaign (a single shared party pin); a scene needs
-- one zone PER CHARACTER, since different party members can be at
-- different ranges from whatever the scene is centered on. Genuinely a
-- different shape, same reasoning `locations`/`location_secrets` or
-- `clocks` got their own tables instead of overloading an existing one.
--
-- No "what Close/Near/Far is relative to" column -- that's exactly the
-- kind of loose narrative context (usually the current threat, but not
-- always -- see the rulebook's own zone examples) a GM already narrates
-- out loud and can log as a plain journal entry if it's worth keeping;
-- inventing a `reference_label` column here would be schema for
-- something this app already has a place for.

create table scene_positions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  zone text not null default 'near' check (zone in ('close', 'near', 'far')),
  updated_at timestamptz not null default now(),
  unique (campaign_id, character_id)
);

alter table scene_positions enable row level security;

create policy scene_positions_select_member on scene_positions
  for select
  using (
    exists (
      select 1 from campaign_members
      where campaign_members.campaign_id = scene_positions.campaign_id
        and campaign_members.user_id = auth.uid()
    )
  );

-- No table-level write policies -- same "reads are RLS-scoped, writes
-- go through a SECURITY DEFINER command" split every other
-- member-writable table in this schema already uses (characters,
-- journal_entries, campaign_map_position).

create or replace function set_scene_position(p_campaign_id uuid, p_character_id uuid, p_zone text)
returns scene_positions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_character characters;
  v_position scene_positions;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_zone not in ('close', 'near', 'far') then
    raise exception 'invalid zone: %', p_zone;
  end if;

  select * into v_character from characters where id = p_character_id;
  if not found or v_character.campaign_id <> p_campaign_id then
    raise exception 'character not found in this campaign';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  insert into scene_positions (campaign_id, character_id, zone, updated_at)
  values (p_campaign_id, p_character_id, p_zone, now())
  on conflict (campaign_id, character_id)
  do update set zone = excluded.zone, updated_at = excluded.updated_at
  returning * into v_position;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'scene_position_set',
    jsonb_build_object('character_id', p_character_id, 'character_name', v_character.name, 'zone', p_zone)
  );

  return v_position;
end;
$$;

grant execute on function set_scene_position(uuid, uuid, text) to authenticated;
revoke execute on function set_scene_position(uuid, uuid, text) from public;
revoke execute on function set_scene_position(uuid, uuid, text) from anon;

-- "Clear scene" -- resets the tracker to empty (every character drops
-- out of Close/Near/Far) rather than to some default zone, so the next
-- scene starts from a genuinely blank tracker instead of everyone
-- silently defaulting back to "near." Any member can clear it, matching
-- the same trust model `set_scene_position` above already uses -- not
-- owner-gated, unlike the maps handout exception (migration 0026).
create or replace function clear_scene(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
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

  delete from scene_positions where campaign_id = p_campaign_id;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into campaign_events (campaign_id, actor, kind, payload)
    values (p_campaign_id, v_uid, 'scene_cleared', jsonb_build_object('count', v_count));
  end if;
end;
$$;

grant execute on function clear_scene(uuid) to authenticated;
revoke execute on function clear_scene(uuid) from public;
revoke execute on function clear_scene(uuid) from anon;
