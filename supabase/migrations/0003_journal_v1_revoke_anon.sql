-- 0003_journal_v1_revoke_anon.sql
-- 0002's `revoke ... from public` didn't actually close the gap: querying
-- pg_proc.proacl showed `anon=X/postgres` as its own grant, separate from
-- the PUBLIC pseudo-role — Supabase grants anon/authenticated execute
-- directly on new public-schema functions, it doesn't route through
-- PUBLIC. Revoking the actual grant this time.
revoke execute on function create_campaign(text) from anon;
revoke execute on function start_session(uuid, text) from anon;
revoke execute on function log_journal_entry(uuid, uuid, text, text, text, text) from anon;
revoke execute on function amend_journal_entry(uuid, text) from anon;
