-- BUILD_PLAN.md item 14 (realtime/presence): adds the three tables a
-- live session actually mutates during play (sessions for
-- start/pause/resume/end, characters for sheet/HP/gold updates,
-- journal_entries for the feed) to the supabase_realtime publication.
-- Every table here already has a `_select_member` RLS policy scoped by
-- campaign_members, and Supabase Realtime enforces that same policy
-- per-subscriber for postgres_changes -- a client only receives change
-- events for rows they could already SELECT, so this is additive
-- (no new read surface), not a security change. Deliberately scoped to
-- these three, not every table: quests/npcs/factions/treasure/notes/
-- locations/clocks are GM-curated content edited rarely, not the
-- "what did the other player just do" signal this slice targets -- can
-- be added to the publication later the same way if that changes.
-- CI-rebuild guard (2026-08-15): the supabase_realtime publication is
-- created by the Supabase platform, so it exists on the live project but
-- NOT in the plain Postgres container verify-db rebuilds into -- which
-- made this migration the rebuild's next failure after the 0023b
-- backfill fixed the phantom tables. Create it when absent; on the real
-- platform this is a no-op.
do $create_pub$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $create_pub$;

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.characters;
alter publication supabase_realtime add table public.journal_entries;
