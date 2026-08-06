-- 0006_end_session.sql
-- New command: end_session — closes the currently open session without
-- starting a new one. Previously the only way to end a session was as
-- a side effect of start_session's auto-close (Amendment 2: "starting
-- the next session is how one ends") — a deliberate decision at the
-- time (SPEC's decisions log: asked and confirmed directly), but real
-- use surfaced a real gap: there was no way to just stop for the night
-- without immediately opening a new, empty next session. Reuses the
-- same `session_ended` ledger event kind start_session already emits
-- on auto-close, so the ledger reads identically either way.
--
-- Still no "pause" — a session that goes quiet stays closed, same as
-- always; resuming means starting a new session, not reopening this
-- one. That was a deliberate choice, not a gap: confirmed directly.

create or replace function end_session(p_campaign_id uuid)
returns sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_open sessions;
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

  select * into v_open from sessions
  where campaign_id = p_campaign_id and ended_at is null
  for update;

  if not found then
    raise exception 'no open session to end';
  end if;

  update sessions set ended_at = now() where id = v_open.id
  returning * into v_open;

  insert into campaign_events (campaign_id, actor, kind, payload)
  values (
    p_campaign_id, v_uid, 'session_ended',
    jsonb_build_object('session_id', v_open.id, 'number', v_open.number)
  );

  return v_open;
end;
$$;

-- Grant to authenticated, then explicitly revoke the default PUBLIC
-- grant and Supabase's separate direct anon grant — both steps this
-- time (0002/0003 had to learn the anon grant isn't routed through
-- PUBLIC the hard way; doing it right here from the start).
grant execute on function end_session(uuid) to authenticated;
revoke execute on function end_session(uuid) from public;
revoke execute on function end_session(uuid) from anon;
