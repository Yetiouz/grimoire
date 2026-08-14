-- 0028_session_recap.sql
-- BUILD_PLAN item 7's remaining gap: "no XP/treasure summary or 'next
-- pickup' note anywhere." SESSION_PROTOCOL.md's own after-session
-- checklist (`_CAMPAIGNS/SESSION_PROTOCOL.md`) has the GM write both by
-- hand into campaign-state.md every session; this closes that gap the
-- same way every other command in this app closes one — a real RPC,
-- not a client-side guess.
--
-- No new column, no new table. Every character mutation since 0009
-- already writes a structured `campaign_events` row (delta, character
-- id) whenever it happens — the data this recap needs already exists,
-- just scattered and never summed. `end_session` is extended with an
-- optional `p_recap_note` (the freeform "where things stand / what's
-- next" note) and, server-side, aggregates every `character_*_changed`
-- event since the session's own `started_at` into one readable
-- summary line per character, plus a clock-advance count (directly
-- answers SESSION_PROTOCOL's step 2, "faction/threat clocks
-- reviewed"). That summary and the freeform note are combined into a
-- single `system` journal_entries row, `session_id`-scoped to the
-- session that just ended — so it lands exactly where
-- `JournalFeed`'s existing per-session divider already puts it: the
-- last thing in that session's run, right where SESSION_PROTOCOL step
-- 1 ("read... the last 2-3 timeline.md entries") would look for it
-- next time. No summary line is written when nothing changed and no
-- note was given — an empty recap isn't worth a row.
--
-- Aggregation is server-side, not client-computed-then-trusted, same
-- trust model `adjust_character_gold`'s own `v_parts` array already
-- uses for its per-call summary line — the client only supplies the
-- note text; every number here is recomputed from the ledger.

-- Postgres treats a changed parameter LIST as a distinct overload, not
-- a replacement — `create or replace function end_session(uuid, text
-- default null)` would coexist alongside the old `end_session(uuid)`
-- rather than superseding it, and a single-arg RPC call could then
-- resolve ambiguously between the two. Drop the old signature first so
-- there's exactly one `end_session` again, same as before this
-- migration.
drop function if exists end_session(uuid);

create or replace function end_session(p_campaign_id uuid, p_recap_note text default null)
returns sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_open sessions;
  v_char record;
  v_char_parts text[] := '{}';
  v_char_line text;
  v_clock_count int;
  v_summary_parts text[] := '{}';
  v_note text := btrim(coalesce(p_recap_note, ''));
  v_body text;
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

  -- Per-character XP/gold/HP/gear roll-up since this session's own
  -- started_at (sessions never overlap — sessions_one_open_per_campaign
  -- guarantees exactly one open session at a time — so every matching
  -- event in that window genuinely belongs to this session, the same
  -- window `JournalFeed`'s own `inferSessionId` already trusts for
  -- gm_chat rows).
  for v_char in
    select
      c.name,
      coalesce(sum(((e.payload ->> 'delta')::int)) filter (where e.kind = 'character_xp_changed'), 0) as xp_delta,
      coalesce(sum(((e.payload ->> 'delta_gp')::int)) filter (where e.kind = 'character_gold_changed'), 0) as gp_delta,
      coalesce(sum(((e.payload ->> 'delta_sp')::int)) filter (where e.kind = 'character_gold_changed'), 0) as sp_delta,
      coalesce(sum(((e.payload ->> 'delta_cp')::int)) filter (where e.kind = 'character_gold_changed'), 0) as cp_delta,
      coalesce(sum(((e.payload ->> 'delta')::int)) filter (where e.kind = 'character_hp_changed'), 0) as hp_delta,
      count(*) filter (where e.kind = 'character_gear_added') as gear_added,
      count(*) filter (where e.kind = 'character_gear_removed') as gear_removed
    from campaign_events e
    join characters c on c.id = (e.payload ->> 'character_id')::uuid
    where e.campaign_id = p_campaign_id
      and e.created_at >= v_open.started_at
      and e.kind in (
        'character_xp_changed', 'character_gold_changed', 'character_hp_changed',
        'character_gear_added', 'character_gear_removed'
      )
    group by c.name
    order by c.name
  loop
    v_char_parts := '{}';
    if v_char.xp_delta <> 0 then
      v_char_parts := v_char_parts || ((case when v_char.xp_delta >= 0 then '+' else '' end) || v_char.xp_delta || ' XP');
    end if;
    if v_char.gp_delta <> 0 then
      v_char_parts := v_char_parts || ((case when v_char.gp_delta >= 0 then '+' else '' end) || v_char.gp_delta || ' gp');
    end if;
    if v_char.sp_delta <> 0 then
      v_char_parts := v_char_parts || ((case when v_char.sp_delta >= 0 then '+' else '' end) || v_char.sp_delta || ' sp');
    end if;
    if v_char.cp_delta <> 0 then
      v_char_parts := v_char_parts || ((case when v_char.cp_delta >= 0 then '+' else '' end) || v_char.cp_delta || ' cp');
    end if;
    if v_char.hp_delta <> 0 then
      v_char_parts := v_char_parts || ('HP ' || (case when v_char.hp_delta >= 0 then '+' else '' end) || v_char.hp_delta);
    end if;
    if v_char.gear_added > 0 then
      v_char_parts := v_char_parts || ('+' || v_char.gear_added || ' item' || (case when v_char.gear_added = 1 then '' else 's' end));
    end if;
    if v_char.gear_removed > 0 then
      v_char_parts := v_char_parts || ('-' || v_char.gear_removed || ' item' || (case when v_char.gear_removed = 1 then '' else 's' end));
    end if;

    if coalesce(array_length(v_char_parts, 1), 0) > 0 then
      v_char_line := v_char.name || ': ' || array_to_string(v_char_parts, ', ');
      v_summary_parts := v_summary_parts || v_char_line;
    end if;
  end loop;

  select count(*) into v_clock_count
  from campaign_events
  where campaign_id = p_campaign_id
    and kind = 'clock_advanced'
    and created_at >= v_open.started_at;

  if v_clock_count > 0 then
    v_summary_parts := v_summary_parts
      || (v_clock_count || ' clock' || (case when v_clock_count = 1 then '' else 's' end) || ' advanced this session');
  end if;

  v_body := '';
  if coalesce(array_length(v_summary_parts, 1), 0) > 0 then
    v_body := 'Session ' || v_open.number || ' recap — ' || array_to_string(v_summary_parts, '; ');
  end if;
  if v_note <> '' then
    if v_body <> '' then
      v_body := v_body || E'\n';
    end if;
    v_body := v_body || 'Next time: ' || v_note;
  end if;

  if v_body <> '' then
    insert into journal_entries (campaign_id, session_id, author, kind, body, actor_name, actor_color)
    values (p_campaign_id, v_open.id, v_uid, 'system', v_body, 'Session wrap-up', null);
  end if;

  return v_open;
end;
$$;

-- Signature changed (new optional trailing param) — grants carry over
-- automatically for a `create or replace function` on the same name,
-- but the explicit grant/revoke trio is repeated here anyway, matching
-- every other migration in this file's own convention of never
-- assuming a prior grant survives a definition change.
grant execute on function end_session(uuid, text) to authenticated;
revoke execute on function end_session(uuid, text) from public;
revoke execute on function end_session(uuid, text) from anon;
