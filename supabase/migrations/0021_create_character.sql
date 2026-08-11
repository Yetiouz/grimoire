-- 0021_create_character.sql
-- BUILD_PLAN.md slice 12: Character Builder — the creation half of the
-- character commands slice (0009 built every *mutation* on an existing
-- row; nothing before this migration could ever produce the row in the
-- first place). Today, `characters` only has data because 0004's
-- one-time Black Road import ran as the database owner directly against
-- the table — there is still no INSERT policy on `characters` for
-- ordinary authenticated users, by design (see 0004's own header
-- comment: "future slices add the commands that mutate this data going
-- forward"). This is that command, for creation specifically.
--
-- Same authorization shape as every command since 0001: campaign
-- membership, not per-character ownership — any member (including the
-- GM building a placeholder PC for a player who hasn't joined yet, the
-- same shape LaLa/Constantine's `awaiting` rows already model) can
-- create a character in their own campaign. `p_member_id`, when given,
-- is validated as a real `campaign_members` row in that same campaign
-- (a character isn't required to be claimed by anyone yet — an
-- unclaimed `p_member_id = null` row is exactly how a GM stages a PC
-- ahead of a real player signing up, same convention 0004 already used).
--
-- Deliberately NOT class/ancestry/rules-aware: this command only ever
-- receives already-computed final values (stats, HP, AC, gold, a sheet
-- jsonb blob) and writes them, the same "trust the client's roll" stance
-- `advance_character_level` documents in the archived Delve prototype's
-- own notes (the class hit-die/talent tables live in the client-side
-- rules module, unreachable from Postgres, and duplicating them
-- server-side would just be a second copy to keep in sync). This is
-- also what keeps the command usable from ANY future game-system rules
-- module (Shadowdark today, Mork Borg later, per campaigns.system /
-- system_packs' existing multi-system seam) without ever touching this
-- migration again — the row shape this table stores has never been
-- system-specific.
--
-- gear_current is derived server-side from `p_sheet.equipment`'s array
-- length rather than taken as a separate param — the same linked-counter
-- invariant `add_character_gear`/`remove_character_gear` already
-- maintain going forward, just applied once at creation instead of left
-- to drift from whatever the client computed independently.

create or replace function create_character(
  p_campaign_id uuid,
  p_name text,
  p_class_title text,
  p_hp_max int,
  p_ac int,
  p_level int default 1,
  p_member_id uuid default null,
  p_background text default null,
  p_alignment_title text default null,
  p_xp_needed int default null,
  p_gear_max int default null,
  p_gold jsonb default '{}'::jsonb,
  p_abilities jsonb default '{}'::jsonb,
  p_sheet jsonb default '{}'::jsonb,
  p_status text default 'active',
  p_color text default null,
  p_session_id uuid default null
)
returns characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_character characters;
  v_gear_current int;
  v_xp_needed int;
  v_level int;
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

  if p_member_id is not null and not exists (
    select 1 from campaign_members where id = p_member_id and campaign_id = p_campaign_id
  ) then
    raise exception 'member does not belong to this campaign';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = p_campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name is required';
  end if;

  if p_class_title is null or btrim(p_class_title) = '' then
    raise exception 'class_title is required';
  end if;

  if p_hp_max is null or p_hp_max < 1 then
    raise exception 'hp_max must be at least 1';
  end if;

  if p_ac is null then
    raise exception 'ac is required';
  end if;

  -- 0-level characters are a real, rules-supported start (rulebook
  -- pg. 14) — floored at 0, not 1, so the funnel flow this migration
  -- also serves doesn't get silently bumped to 1st level.
  v_level := greatest(coalesce(p_level, 1), 0);
  v_xp_needed := coalesce(p_xp_needed, greatest(v_level, 1) * 10);
  v_gear_current := coalesce(jsonb_array_length(p_sheet -> 'equipment'), 0);

  insert into characters (
    campaign_id, member_id, name, class_title, background, alignment_title,
    level, xp_current, xp_needed, hp_current, hp_max, ac,
    gear_current, gear_max, gold, abilities, sheet, status, color
  )
  values (
    p_campaign_id, p_member_id, btrim(p_name), btrim(p_class_title), p_background, p_alignment_title,
    v_level, 0, v_xp_needed, p_hp_max, p_hp_max, p_ac,
    v_gear_current, p_gear_max, coalesce(p_gold, '{}'::jsonb), coalesce(p_abilities, '{}'::jsonb), coalesce(p_sheet, '{}'::jsonb),
    coalesce(nullif(btrim(p_status), ''), 'active'), p_color
  )
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'character_created',
    jsonb_build_object(
      'character_id', v_character.id, 'name', v_character.name,
      'class_title', v_character.class_title, 'level', v_character.level
    )
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      p_campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ' joins the party as a ' || v_character.class_title || '.',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

grant execute on function create_character(
  uuid, text, text, int, int, int, uuid, text, text, int, int, jsonb, jsonb, jsonb, text, text, uuid
) to authenticated;

revoke execute on function create_character(
  uuid, text, text, int, int, int, uuid, text, text, int, int, jsonb, jsonb, jsonb, text, text, uuid
) from public;

revoke execute on function create_character(
  uuid, text, text, int, int, int, uuid, text, text, int, int, jsonb, jsonb, jsonb, text, text, uuid
) from anon;
