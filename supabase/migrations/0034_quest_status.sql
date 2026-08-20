-- 0034_quest_status.sql
-- Closes the gold/quest persistence gap found in the 2026-08-19 Black
-- Road audit (see claude/grimoire-gold-quest-tools-pending.md, this
-- project's Claude Project) — the AI GM could narrate a quest's status
-- changing but had no command to actually move it, so the tracker went
-- stale even when the story moved on. Mirrors adjust_character_hp's own
-- shape (0009_character_commands.sql): SECURITY DEFINER, membership
-- check (any member, not owner-only — matching every other character/
-- quest mutation in this schema, which trusts the whole table rather
-- than gating to the GM specifically), optional p_session_id for the
-- journal echo, campaign_events ledger write always.
--
-- Deliberately narrow: moves status and optionally appends one short
-- note to the quest's existing summary. Cannot create a new quest or
-- rewrite its goal/claimant — see prompt.ts's TRANSLATION block for the
-- GM-facing framing of that boundary.
--
-- NOTE: this function was already applied live on 2026-08-19 (session
-- gap — see claude/grimoire-gold-quest-tools-pending.md); this file
-- exists purely to give the repo's migration history a record of it. A
-- plain create-or-replace re-apply, safe and idempotent either way.

create or replace function update_quest_status(
  p_campaign_id uuid,
  p_quest_code text,
  p_new_status text,
  p_note text default null,
  p_session_id uuid default null
)
returns quests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_quest quests;
  v_old_status text;
  v_new_status text;
  v_note text;
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

  if p_session_id is not null and not exists (
    select 1 from sessions where id = p_session_id and campaign_id = p_campaign_id
  ) then
    raise exception 'session does not belong to this campaign';
  end if;

  v_new_status := btrim(coalesce(p_new_status, ''));
  if v_new_status = '' then
    raise exception 'new status is required';
  end if;

  select * into v_quest from quests
  where campaign_id = p_campaign_id and code = p_quest_code
  for update;
  if not found then
    raise exception 'no quest with code % in this campaign', p_quest_code;
  end if;

  v_old_status := v_quest.status;
  v_note := btrim(coalesce(p_note, ''));

  update quests
  set
    status = v_new_status,
    summary = case when v_note <> '' then btrim(v_quest.summary || ' ' || v_note) else v_quest.summary end
  where id = v_quest.id
  returning * into v_quest;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    v_quest.campaign_id, v_uid, 'quest_status_changed',
    jsonb_build_object('quest_id', v_quest.id, 'code', v_quest.code,
      'status_before', v_old_status, 'status_after', v_quest.status, 'note', nullif(v_note, ''))
  );

  if p_session_id is not null then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (
      v_quest.campaign_id, p_session_id, v_uid, 'system',
      '[' || v_quest.code || '] ' || v_quest.title || ': ' || v_old_status || ' -> ' || v_quest.status,
      'GM', '#35f0ff'
    );
  end if;

  return v_quest;
end;
$$;

grant execute on function update_quest_status(uuid, text, text, text, uuid) to authenticated;
revoke execute on function update_quest_status(uuid, text, text, text, uuid) from public;
revoke execute on function update_quest_status(uuid, text, text, text, uuid) from anon;
