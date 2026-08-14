-- 0030_set_character_hp_max.sql
-- Closes a real gap found investigating a live report: CharacterBuilder's
-- "Roll HP" control lives on the Review step as an optional ghost
-- button (nothing gates Create on having clicked it), so a character
-- can be created with hp_max left at its unrolled floor value. Once
-- created, hp_max was permanently locked -- adjust_character_hp
-- (0009_character_commands.sql) only moves hp_current within [0,
-- hp_max], there was no command to correct hp_max itself. This adds
-- exactly that, same SECURITY DEFINER / membership-check / optional
-- session-echo shape as every other command in this file's lineage.
--
-- hp_current is clamped down if it now exceeds the new hp_max (can't
-- be above max), but is never bumped up by raising hp_max -- matches
-- adjust_character_hp's own floor/ceiling behavior, no free healing.

create or replace function set_character_hp_max(
  p_character_id uuid,
  p_hp_max int,
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
  v_old_hp_max int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_hp_max is null or p_hp_max < 1 then
    raise exception 'hp_max must be at least 1';
  end if;

  select * into v_character from characters where id = p_character_id for update;
  if not found then
    raise exception 'character not found';
  end if;

  if not exists (
    select 1 from campaign_members
    where campaign_id = v_character.campaign_id and user_id = v_uid
  ) then
    raise exception 'not a member of this campaign';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = v_character.campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  v_old_hp_max := v_character.hp_max;

  update characters
  set hp_max = p_hp_max,
      hp_current = least(hp_current, p_hp_max)
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_hp_max_changed',
    jsonb_build_object('character_id', v_character.id, 'old_hp_max', v_old_hp_max, 'hp_max', v_character.hp_max)
  );

  if p_session_id is not null and v_character.hp_max <> v_old_hp_max then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': Max HP ' || v_old_hp_max || ' -> ' || v_character.hp_max,
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

grant execute on function set_character_hp_max(uuid, int, uuid) to authenticated;
revoke execute on function set_character_hp_max(uuid, int, uuid) from public;
revoke execute on function set_character_hp_max(uuid, int, uuid) from anon;
