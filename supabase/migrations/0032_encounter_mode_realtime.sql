-- 0032_encounter_mode_realtime.sql
-- Adds `encounter_monsters`/`turn_order` (migration 0031) to the
-- `supabase_realtime` publication -- without this, Postgres Changes never
-- emits anything for either table regardless of RLS, same gate migration
-- `0027_realtime_publication.sql` first documented for
-- `sessions`/`characters`/`journal_entries`.
--
-- Unlike `scene_positions` (item 18's own explicit call not to extend
-- realtime yet, "would need its own scoped subscription lifecycle"), a
-- turn tracker genuinely needs live sync: the whole point is that when
-- the GM rolls initiative or advances the turn, every other player's
-- screen updates without a manual refresh. `turn_order` is subscribed at
-- the top level (`JournalScreen`, alongside sessions/characters/entries)
-- so `PlayerCard`'s active-turn ring stays live outside the Maps overlay
-- too; `encounter_monsters` is subscribed locally inside `EncounterPanel`
-- only (its own scoped lifecycle, matching `scene_positions`' own
-- reasoning -- monster detail is only ever shown there).
alter publication supabase_realtime add table encounter_monsters;
alter publication supabase_realtime add table turn_order;
