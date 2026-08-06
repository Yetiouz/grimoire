-- 0009_character_commands.sql
-- BUILD_PLAN.md slice 6: Character commands — the mutation half of
-- slice 3 (view side landed in 0004/0005 + CharacterSheet). Every
-- mutation goes through a SECURITY DEFINER command writing a
-- campaign_events ledger row (source of truth, same shape as every
-- other command since 0001) plus, when the caller passes a real open
-- session id, a `system`-kind journal_entries row so the change shows
-- up in the log without anyone touching markdown. journal_entries.
-- session_id is NOT NULL by table constraint (0001), so the echo only
-- happens when a session id is supplied — these commands still work
-- with no open session (e.g. GM bookkeeping between sessions), they
-- just skip the log line rather than being blocked by it.
--
-- Authorization matches every other command since 0001: campaign
-- membership, not per-character ownership — any member can adjust any
-- character in their campaign (the GM adjusting a player's HP is the
-- common case, not the exception).
--
-- Leveling (crossing xp_needed) is deliberately out of scope: it's not
-- just a number bump (new HP roll, a new talent), so
-- adjust_character_xp only moves the number, floored at 0, never
-- auto-leveling.
--
-- Gear (asked and confirmed directly): equipment-list add/remove is
-- linked to the gear_current slot counter, one slot per item,
-- capacity-checked against gear_max when it's set (gear_max is
-- nullable — some imported characters never had a slot cap recorded,
-- in which case no capacity check applies, matching how CharacterSheet
-- already treats a null gear_max as "no known cap" rather than
-- fabricating one). remove_character_gear takes the equipment array's
-- index rather than matching by name, since the source data has no
-- guarantee item names are unique (two "Torch" entries are plausible)
-- and the client always has the exact ordered array to index into.

create or replace function adjust_character_hp(
  p_character_id uuid,
  p_delta int,
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
  v_old_hp int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  v_old_hp := v_character.hp_current;

  update characters
  set hp_current = greatest(0, least(v_character.hp_max, v_character.hp_current + p_delta))
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_hp_changed',
    jsonb_build_object('character_id', v_character.id, 'delta', v_character.hp_current - v_old_hp,
      'hp_current', v_character.hp_current, 'hp_max', v_character.hp_max)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': HP ' || v_old_hp || ' -> ' || v_character.hp_current
        || ' (' || (case when v_character.hp_current - v_old_hp >= 0 then '+' else '' end)
        || (v_character.hp_current - v_old_hp) || ')',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

create or replace function adjust_character_xp(
  p_character_id uuid,
  p_delta int,
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
  v_old_xp int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  v_old_xp := v_character.xp_current;

  update characters
  set xp_current = greatest(0, v_character.xp_current + p_delta)
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_xp_changed',
    jsonb_build_object('character_id', v_character.id, 'delta', v_character.xp_current - v_old_xp,
      'xp_current', v_character.xp_current, 'xp_needed', v_character.xp_needed)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': XP ' || v_old_xp || ' -> ' || v_character.xp_current
        || ' (' || (case when v_character.xp_current - v_old_xp >= 0 then '+' else '' end)
        || (v_character.xp_current - v_old_xp) || ')',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

create or replace function adjust_character_gold(
  p_character_id uuid,
  p_gp int default 0,
  p_sp int default 0,
  p_cp int default 0,
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
  v_old_gp int;
  v_old_sp int;
  v_old_cp int;
  v_new_gp int;
  v_new_sp int;
  v_new_cp int;
  v_parts text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  v_old_gp := coalesce((v_character.gold ->> 'gp')::int, 0);
  v_old_sp := coalesce((v_character.gold ->> 'sp')::int, 0);
  v_old_cp := coalesce((v_character.gold ->> 'cp')::int, 0);
  v_new_gp := greatest(0, v_old_gp + coalesce(p_gp, 0));
  v_new_sp := greatest(0, v_old_sp + coalesce(p_sp, 0));
  v_new_cp := greatest(0, v_old_cp + coalesce(p_cp, 0));

  update characters
  set gold = jsonb_build_object('gp', v_new_gp, 'sp', v_new_sp, 'cp', v_new_cp)
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_gold_changed',
    jsonb_build_object('character_id', v_character.id, 'delta_gp', v_new_gp - v_old_gp,
      'delta_sp', v_new_sp - v_old_sp, 'delta_cp', v_new_cp - v_old_cp, 'gold', v_character.gold)
  );

  if v_new_gp - v_old_gp <> 0 then
    v_parts := v_parts || ((case when v_new_gp - v_old_gp >= 0 then '+' else '' end) || (v_new_gp - v_old_gp) || ' gp');
  end if;
  if v_new_sp - v_old_sp <> 0 then
    v_parts := v_parts || ((case when v_new_sp - v_old_sp >= 0 then '+' else '' end) || (v_new_sp - v_old_sp) || ' sp');
  end if;
  if v_new_cp - v_old_cp <> 0 then
    v_parts := v_parts || ((case when v_new_cp - v_old_cp >= 0 then '+' else '' end) || (v_new_cp - v_old_cp) || ' cp');
  end if;

  if p_session_id is not null and coalesce(array_length(v_parts, 1), 0) > 0 then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': ' || array_to_string(v_parts, ', '),
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

create or replace function add_character_gear(
  p_character_id uuid,
  p_item_name text,
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
  v_current_count int;
  v_item text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_item := btrim(coalesce(p_item_name, ''));
  if v_item = '' then
    raise exception 'item name is required';
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

  v_current_count := coalesce(v_character.gear_current, 0);

  if v_character.gear_max is not null and v_current_count + 1 > v_character.gear_max then
    raise exception 'no free gear slots';
  end if;

  update characters
  set
    sheet = jsonb_set(
      v_character.sheet,
      '{equipment}',
      coalesce(v_character.sheet -> 'equipment', '[]'::jsonb) || to_jsonb(v_item)
    ),
    gear_current = v_current_count + 1
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_gear_added',
    jsonb_build_object('character_id', v_character.id, 'item', v_item,
      'gear_current', v_character.gear_current, 'gear_max', v_character.gear_max)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ' picks up ' || v_item || '.',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

create or replace function remove_character_gear(
  p_character_id uuid,
  p_item_index int,
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
  v_equipment jsonb;
  v_item_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  v_equipment := coalesce(v_character.sheet -> 'equipment', '[]'::jsonb);

  if p_item_index is null or p_item_index < 0 or p_item_index >= jsonb_array_length(v_equipment) then
    raise exception 'invalid gear index';
  end if;

  v_item_name := v_equipment ->> p_item_index;

  update characters
  set
    sheet = jsonb_set(v_character.sheet, '{equipment}', v_equipment - p_item_index),
    gear_current = greatest(0, coalesce(v_character.gear_current, 0) - 1)
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_gear_removed',
    jsonb_build_object('character_id', v_character.id, 'item', v_item_name,
      'gear_current', v_character.gear_current, 'gear_max', v_character.gear_max)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ' drops ' || v_item_name || '.',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

create or replace function rest_character(
  p_character_id uuid,
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
  v_old_hp int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  v_old_hp := v_character.hp_current;

  update characters
  set hp_current = v_character.hp_max
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_rested',
    jsonb_build_object('character_id', v_character.id, 'hp_before', v_old_hp, 'hp_current', v_character.hp_current)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ' takes a full rest -- HP restored to ' || v_character.hp_current || '/' || v_character.hp_max || '.',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

grant execute on function adjust_character_hp(uuid, int, uuid) to authenticated;
grant execute on function adjust_character_xp(uuid, int, uuid) to authenticated;
grant execute on function adjust_character_gold(uuid, int, int, int, uuid) to authenticated;
grant execute on function add_character_gear(uuid, text, uuid) to authenticated;
grant execute on function remove_character_gear(uuid, int, uuid) to authenticated;
grant execute on function rest_character(uuid, uuid) to authenticated;

revoke execute on function adjust_character_hp(uuid, int, uuid) from public;
revoke execute on function adjust_character_xp(uuid, int, uuid) from public;
revoke execute on function adjust_character_gold(uuid, int, int, int, uuid) from public;
revoke execute on function add_character_gear(uuid, text, uuid) from public;
revoke execute on function remove_character_gear(uuid, int, uuid) from public;
revoke execute on function rest_character(uuid, uuid) from public;

revoke execute on function adjust_character_hp(uuid, int, uuid) from anon;
revoke execute on function adjust_character_xp(uuid, int, uuid) from anon;
revoke execute on function adjust_character_gold(uuid, int, int, int, uuid) from anon;
revoke execute on function add_character_gear(uuid, text, uuid) from anon;
revoke execute on function remove_character_gear(uuid, int, uuid) from anon;
revoke execute on function rest_character(uuid, uuid) from anon;
