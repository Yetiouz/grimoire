-- 0022_character_luck.sql
-- Adds Luck Token tracking to characters -- flagged as a real schema gap
-- while reviewing the reorganized Character Sheet mockup: the sheet
-- wanted a Luck vitals tile, but nothing in the schema tracked it. This
-- project's attempt-1 predecessor (Delve, archived) hit the exact same
-- gap and closed it the same shape -- see claude/delve-phase3-scope.md
-- for that precedent (reference only, not copied from). Delve also has
-- a documented cautionary tale worth heeding here (claude/delve-ci-
-- green-and-migration-drift.md): its own luck_tokens migration, among
-- ~25 others, was applied live via MCP and never committed as a repo
-- file, so the repo's migration chain silently drifted out of sync with
-- prod. This file exists specifically so that doesn't happen again --
-- applied live via the Supabase MCP AND committed here in the same
-- pass.
--
-- Shadowdark's own rule (rulebook p.79, paraphrased, not reproduced):
-- the GM awards a luck token for standout play; a player spends one to
-- reroll a roll they just made, or hands it to a companion. Normally
-- capped at one per player, uncapped under Pulp Mode. This app has no
-- structured modes-of-play column to key a hard cap off of (Grimoire's
-- mode toggles live as GM-facing narrative text in a campaign's own
-- campaign-state.md, not queryable data) -- so, like
-- adjust_character_xp, this floors at 0 and does NOT hard-cap at 1;
-- enforcing the normal-vs-Pulp cap is left to the GM, same trust model
-- every other GM-triggered adjustment in this file already uses.
--
-- Same SECURITY DEFINER / membership-check / optional session-echo
-- shape as every command in 0009_character_commands.sql.

alter table characters
  add column luck_tokens integer not null default 0 check (luck_tokens >= 0);

create or replace function adjust_character_luck(
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
  v_old_luck int;
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

  v_old_luck := v_character.luck_tokens;

  update characters
  set luck_tokens = greatest(0, v_character.luck_tokens + p_delta)
  where id = p_character_id
  returning * into v_character;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_character.campaign_id, v_uid, 'character_luck_changed',
    jsonb_build_object('character_id', v_character.id, 'delta', v_character.luck_tokens - v_old_luck,
      'luck_tokens', v_character.luck_tokens)
  );

  if p_session_id is not null and v_character.luck_tokens <> v_old_luck then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_character.campaign_id, p_session_id, v_uid, 'system',
      v_character.name || ': Luck ' || v_old_luck || ' -> ' || v_character.luck_tokens
        || ' (' || (case when v_character.luck_tokens - v_old_luck >= 0 then '+' else '' end)
        || (v_character.luck_tokens - v_old_luck) || ')',
      v_character.name, v_character.color
    );
  end if;

  return v_character;
end;
$$;

grant execute on function adjust_character_luck(uuid, int, uuid) to authenticated;
revoke execute on function adjust_character_luck(uuid, int, uuid) from public;
revoke execute on function adjust_character_luck(uuid, int, uuid) from anon;
