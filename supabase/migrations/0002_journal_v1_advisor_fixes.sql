-- 0002_journal_v1_advisor_fixes.sql
-- Fixes for every finding get_advisors raised against 0001, run
-- immediately after applying it per the user's explicit expectation.

-- ── Revoke the default PUBLIC execute grant ─────────────────────────
-- Postgres grants EXECUTE to PUBLIC on every new function unless it's
-- explicitly revoked — 0001 granted to `authenticated` but never
-- revoked the default, so `anon` could still call all four RPCs. Each
-- function already self-defends (`if v_uid is null then raise
-- exception`), so this wasn't an actual bypass, but least-privilege
-- says close it properly rather than lean on that as the only guard.
revoke execute on function create_campaign(text) from public;
revoke execute on function start_session(uuid, text) from public;
revoke execute on function log_journal_entry(uuid, uuid, text, text, text, text) from public;
revoke execute on function amend_journal_entry(uuid, text) from public;

-- ── Stop re-evaluating auth.uid() per row ───────────────────────────
-- Wrapping in (select auth.uid()) lets Postgres evaluate it once per
-- query (an initplan) instead of once per row scanned.
alter policy campaign_members_select_own
  on campaign_members
  using (user_id = (select auth.uid()));

alter policy campaigns_select_member
  on campaigns
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = campaigns.id
      and campaign_members.user_id = (select auth.uid())
  ));

alter policy sessions_select_member
  on sessions
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = sessions.campaign_id
      and campaign_members.user_id = (select auth.uid())
  ));

alter policy journal_entries_select_member
  on journal_entries
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = journal_entries.campaign_id
      and campaign_members.user_id = (select auth.uid())
  ));

alter policy campaign_events_select_member
  on campaign_events
  using (exists (
    select 1 from campaign_members
    where campaign_members.campaign_id = campaign_events.campaign_id
      and campaign_members.user_id = (select auth.uid())
  ));

-- ── Cover the unindexed foreign keys ────────────────────────────────
create index campaigns_owner_idx on campaigns (owner);
create index campaign_members_user_id_idx on campaign_members (user_id);
create index journal_entries_author_idx on journal_entries (author);
create index journal_entries_session_id_idx on journal_entries (session_id);
create index campaign_events_actor_idx on campaign_events (actor);
