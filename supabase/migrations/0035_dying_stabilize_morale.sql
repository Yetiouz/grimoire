-- 0035_dying_stabilize_morale.sql
-- Encounter mode phase 3 (grimoire-phase19-encounter-mode-scope.md,
-- this project's Claude Project) — dying, stabilizing, and morale.
-- Phases 1-2 (monsters + initiative + turn order UI) shipped
-- 2026-08-14 in 0031/0032. Phase 4 (AI GM combat tools) is explicitly
-- deferred to its own future pass, same "human table first" sequencing
-- the scope doc laid out — nothing here touches the gm_turn edge
-- function.
--
-- Grounded in the rulebook (pg. 88-90), not re-derived from memory:
-- 0 HP = unconscious and dying. Death timer = 1d4 + CON mod (min 1)
-- rounds, counted down each of the dying character's own turns; roll a
-- d20 each of those turns, natural 20 = rise with 1 HP (some class
-- talents widen this range -- see resolve_dying_turn below). Stabilize
-- = DC 15 INT check at Close range by an ally; target stays
-- unconscious but stops dying. Timer reaching 0 = character perishes.
-- Morale: a group reduced to half its number (or a solo enemy to half
-- HP) flees on a failed DC 15 WIS check, one roll, leader's modifier.

-- ── schema: characters.death_timer_rounds ───────────────────────────
-- Null unless dying, per the scope doc's own decision: "set by the
-- same adjust_character_hp RPC the moment HP hits 0 -- not a separate
-- mutation path, so the ledger stays the single source of truth."
alter table characters
  add column death_timer_rounds int
    check (death_timer_rounds is null or death_timer_rounds >= 0);

-- ── adjust_character_hp: now dying-aware ────────────────────────────
-- Same shape as 0009's original (membership check, floor-at-0/
-- ceiling-at-max, campaign_events + optional journal echo) plus two
-- new transitions, both driven off the actual old/new HP values so
-- this stays the single place dying state changes -- never a client-
-- computed flag:
--   * hp drops from >0 to 0: roll the death timer (1d4 + CON mod,
--     floored at 1) and start dying.
--   * hp rises from 0 to >0 (healed, not a dying-turn rise -- that
--     path is resolve_dying_turn below): clear the timer, no longer
--     dying.
-- A character who has already perished (status = 'dead') can't be
-- further adjusted here -- that status is the one true terminal state
-- this schema now has, and un-perishing someone isn't a delta this
-- command should silently allow.
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
  v_con_mod int;
  v_timer int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_character from characters where id = p_character_id for update;
  if not found then
    raise exception 'character not found';
  end if;

  if v_character.status = 'dead' then
    raise exception 'this character has perished and cannot be adjusted here';
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

  if v_old_hp > 0 and v_character.hp_current = 0 then
    v_con_mod := coalesce((v_character.abilities -> 'con' ->> 'mod')::int, 0);
    v_timer := greatest(1, (1 + floor(random() * 4)::int) + v_con_mod);
    update characters set death_timer_rounds = v_timer where id = p_character_id returning * into v_character;
  elsif v_old_hp = 0 and v_character.hp_current > 0 and v_character.death_timer_rounds is not null then
    update characters set death_timer_rounds = null where id = p_character_id returning * into v_character;
  end if;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_hp_changed',
    jsonb_build_object('character_id', v_character.id, 'delta', v_character.hp_current - v_old_hp,
      'hp_current', v_character.hp_current, 'hp_max', v_character.hp_max,
      'death_timer_rounds', v_character.death_timer_rounds)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': HP ' || v_old_hp || ' -> ' || v_character.hp_current
        || ' (' || (case when v_character.hp_current - v_old_hp >= 0 then '+' else '' end)
        || (v_character.hp_current - v_old_hp) || ')'
        || (case
              when v_old_hp > 0 and v_character.hp_current = 0
                then ' -- down and dying (timer: ' || v_character.death_timer_rounds || ')'
              when v_old_hp = 0 and v_character.hp_current > 0
                then ' -- stable, no longer dying'
              else ''
            end),
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

-- ── resolve_dying_turn ───────────────────────────────────────────────
-- Called once per the dying character's own turn. Same permissive
-- "any campaign member" gate adjust_character_hp already uses (this
-- schema trusts the whole table for character mutations, not just the
-- GM) rather than a new, stricter check invented for this one command.
--
-- Rise threshold defaults to a natural 20, but some class talents
-- widen it (e.g. Sea Wolves' Last Stand: "rise from dying with 1 HP on
-- a natural roll of 18-20", lib/rules/shadowdark.ts:317). There's no
-- dedicated talents column to key off of -- sheet.attacks_talents is a
-- free-text array -- so this reads the character's own sheet text for
-- "last stand" rather than hardcoding a class name, per the scope
-- doc's own instruction: "Any dying/death UI needs to read the
-- character's own talents, not hardcode natural 20 as universal."
create or replace function resolve_dying_turn(
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
  v_roll int;
  v_threshold int := 20;
  v_body text;
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

  if v_character.death_timer_rounds is null then
    raise exception 'this character is not dying';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = v_character.campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  if v_character.sheet::text ilike '%last stand%' then
    v_threshold := 18;
  end if;

  v_roll := 1 + floor(random() * 20)::int;

  if v_roll >= v_threshold then
    update characters
    set hp_current = 1, death_timer_rounds = null
    where id = p_character_id
    returning * into v_character;

    v_body := v_character.name || ' claws back from the brink -- rises with 1 HP! (rolled ' || v_roll || ')';

    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_character.campaign_id, v_uid, 'character_rallied',
      jsonb_build_object('character_id', v_character.id, 'roll', v_roll, 'threshold', v_threshold));
  elsif v_character.death_timer_rounds - 1 <= 0 then
    update characters
    set death_timer_rounds = 0, status = 'dead'
    where id = p_character_id
    returning * into v_character;

    v_body := v_character.name || ' has died.';

    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_character.campaign_id, v_uid, 'character_perished',
      jsonb_build_object('character_id', v_character.id, 'roll', v_roll));
  else
    update characters
    set death_timer_rounds = death_timer_rounds - 1
    where id = p_character_id
    returning * into v_character;

    v_body := v_character.name || ' is dying -- rolled ' || v_roll || ', '
      || v_character.death_timer_rounds || ' round' || (case when v_character.death_timer_rounds = 1 then '' else 's' end)
      || ' left.';

    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_character.campaign_id, v_uid, 'dying_turn_resolved',
      jsonb_build_object('character_id', v_character.id, 'roll', v_roll, 'rounds_left', v_character.death_timer_rounds));
  end if;

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (v_character.campaign_id, p_session_id, v_uid, 'system', v_body, v_character.name, v_character.color);
  end if;

  return v_character;
end;
$$;

-- ── resolve_stabilize_check ──────────────────────────────────────────
-- One ally attempts a DC 15 INT check to stop a dying character's
-- timer (rulebook: "at Close range" -- zone adjacency isn't enforced
-- here, same trust-the-table posture as roll_initiative not checking
-- who's actually present; a future pass could cross-check
-- scene_positions if that gap ever matters in play). Returns jsonb
-- rather than the bare characters row -- a failed check is a real,
-- meaningful outcome with nothing to echo back on the row itself, so
-- the caller needs the roll/success shape either way, not just a
-- row that may be unchanged.
create or replace function resolve_stabilize_check(
  p_character_id uuid,
  p_helper_character_id uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_character characters;
  v_helper characters;
  v_int_mod int;
  v_roll int;
  v_total int;
  v_success boolean;
  v_body text;
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

  if v_character.death_timer_rounds is null then
    raise exception 'this character is not dying';
  end if;

  select * into v_helper from characters
  where id = p_helper_character_id and campaign_id = v_character.campaign_id;
  if not found then
    raise exception 'helper character not found in this campaign';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = v_character.campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  v_int_mod := coalesce((v_helper.abilities -> 'int' ->> 'mod')::int, 0);
  v_roll := 1 + floor(random() * 20)::int;
  v_total := v_roll + v_int_mod;
  v_success := v_total >= 15;

  if v_success then
    update characters set death_timer_rounds = null where id = p_character_id returning * into v_character;
    v_body := v_helper.name || ' stabilizes ' || v_character.name || ' (rolled ' || v_total || ' vs DC 15).';
  else
    v_body := v_helper.name || ' fails to stabilize ' || v_character.name || ' (rolled ' || v_total || ' vs DC 15).';
  end if;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, case when v_success then 'character_stabilized' else 'stabilize_failed' end,
    jsonb_build_object('character_id', v_character.id, 'helper_character_id', v_helper.id, 'roll', v_total, 'dc', 15)
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (v_character.campaign_id, p_session_id, v_uid, 'system', v_body, v_helper.name, v_helper.color);
  end if;

  return jsonb_build_object(
    'success', v_success, 'roll', v_total, 'dc', 15,
    'character', to_jsonb(v_character)
  );
end;
$$;

-- ── resolve_morale_check ─────────────────────────────────────────────
-- GM-only, same "owner" gate every other encounter_monsters command in
-- 0031 uses. Scoped to one monster row at a time -- Grimoire's
-- encounter_monsters has no group concept (each row is already how a
-- GM represents one member of a group, e.g. "Goblin #2" -- see 0031's
-- own comment), so "the group" per the rulebook's DC 15 WIS check
-- becomes "check each row the GM judges is part of it," same
-- per-monster granularity every other encounter_monsters command
-- already has (damage/visibility). The leader's WIS modifier isn't
-- tracked anywhere on a monster's stat_block (only dex_mod is, for
-- initiative) -- the GM supplies it directly, same trust-the-client
-- posture add_encounter_monster already takes for a monster's whole
-- stat block.
--
-- A failed check means this monster flees: deleted from
-- encounter_monsters and pulled out of turn_order.combatants so it
-- stops coming up in the rotation, mirroring end_encounter's own
-- delete-on-exit pattern rather than inventing a new "fled" status
-- this schema has nowhere to render.
create or replace function resolve_morale_check(
  p_monster_id uuid,
  p_wis_mod int default 0,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_monster encounter_monsters;
  v_roll int;
  v_total int;
  v_success boolean;
  v_body text;
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
    raise exception 'only the campaign owner can call a morale check';
  end if;

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = v_monster.campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  v_roll := 1 + floor(random() * 20)::int;
  v_total := v_roll + p_wis_mod;
  v_success := v_total >= 15;

  if v_success then
    v_body := v_monster.label || ' holds its ground (rolled ' || v_total || ' vs DC 15).';

    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_monster.campaign_id, v_uid, 'monster_holds',
      jsonb_build_object('monster_id', v_monster.id, 'label', v_monster.label, 'roll', v_total));
  else
    v_body := v_monster.label || ' fails morale (rolled ' || v_total || ' vs DC 15) and flees!';

    insert into campaign_events (campaign_id, actor, kind, payload)
    values (v_monster.campaign_id, v_uid, 'monster_fled',
      jsonb_build_object('monster_id', v_monster.id, 'label', v_monster.label, 'roll', v_total));

    update turn_order
    set combatants = coalesce((
      select jsonb_agg(elem) from jsonb_array_elements(combatants) elem
      where elem ->> 'combatant_id' <> p_monster_id::text
    ), '[]'::jsonb)
    where campaign_id = v_monster.campaign_id;

    delete from encounter_monsters where id = p_monster_id;
  end if;

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (v_monster.campaign_id, p_session_id, v_uid, 'system', v_body, 'Encounter', null);
  end if;

  return jsonb_build_object('success', v_success, 'roll', v_total, 'dc', 15, 'fled', not v_success, 'label', v_monster.label);
end;
$$;

grant execute on function resolve_dying_turn(uuid, uuid) to authenticated;
revoke execute on function resolve_dying_turn(uuid, uuid) from public;
revoke execute on function resolve_dying_turn(uuid, uuid) from anon;

grant execute on function resolve_stabilize_check(uuid, uuid, uuid) to authenticated;
revoke execute on function resolve_stabilize_check(uuid, uuid, uuid) from public;
revoke execute on function resolve_stabilize_check(uuid, uuid, uuid) from anon;

grant execute on function resolve_morale_check(uuid, int, uuid) to authenticated;
revoke execute on function resolve_morale_check(uuid, int, uuid) from public;
revoke execute on function resolve_morale_check(uuid, int, uuid) from anon;
