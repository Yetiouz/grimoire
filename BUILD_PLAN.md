# Grimoire — Build Order, Components, and the Multi-System Question

*Derived Aug 4 2026 from the full Shadowdark collection (core V4-9, Quickstart, Cursed Scrolls 1–3, Mini Adventures, Shadowdome) and — most importantly — the live file-based campaign system in `_CAMPAIGNS/`, especially The Black Road. Companion to SPEC.md; where they conflict, SPEC.md wins after discussion.*

## The governing insight

The user already runs a complete campaign-management system today: markdown files + a tracker spreadsheet, maintained by hand between chat sessions (`campaign-state.md`, `timeline.md`, `quest-log.md`, `npc-log.md`, `objective-list.md`, `tracker.xlsx`, character sheets, maps, plus shared GM persona / house rules / session protocol). **Grimoire's Milestone 1 is, concretely, replacing those files** — every slice below exists because a file in that folder proves the need is real. The Black Road is also *designed* to grow from a solo prologue into a three-player family campaign — which is exactly Grimoire's Milestone 2 (friends join). The campaign and the app are on converging paths.

## Build order

Ordered so each slice replaces a real file the user maintains by hand today, and each is independently useful the week it ships.

**Status refreshed 2026-08-14** by a full code-level audit (this banner and the list below had drifted badly out of sync with what's actually shipped — items 6 through 12 were still marked "remaining" despite being built weeks ago; nobody had come back to check them off). Audit method: grep the real source for each item's described RPCs/components, read the call sites, and for the highest-uncertainty ones (AI GM) cross-check against what was actually observed live in the browser this session. Every claim below is grounded in a specific file, not a guess.

**Status refreshed again 2026-08-21.** Item 13 (Encounter mode) shipped in four phases between 2026-08-20 and 2026-08-21 — see `grimoire-phase19-encounter-mode-scope.md` in the Shadowdark Claude Project for the slice-by-slice writeup. **That closes every item on this list — there is nothing left marked NOT BUILT below.** Two persistence gaps found after the fact and closed the same week: `adjust_gold`/`update_quest_status` (2026-08-19) and `adjust_xp`/`add_gear`/`remove_gear` (2026-08-21) — the AI GM could narrate gold, quest status, XP, and gear changes without any of them ever landing in the database; all five now write through real RPCs from `gm_turn`'s tool registry, same as HP always did. See `grimoire-gold-quest-tools-pending.md` for the full history. Also noted in passing during this pass: CY_BORG is already a second live game system (`a6c3926`, `SystemDisplay` in `lib/rules`) — the multi-system design in this doc's own last section is not hypothetical anymore, it's shipped.

**SHIPPED:**

✅ 1. Campaign core + journal + event ledger (migrations 0001–0003, five-kind taxonomy incl. chat). ✅ 2. The Black Road import (0004 — 144 entries, 3 PCs, 17 NPCs, 7 quests, 13 treasure items, live). ✅ 3a. Characters, view side (PlayerCard + CharacterSheet overlay, real colors via 0005). ✅ 4. Server-authoritative dice (0007–0008: roll_dice, advantage/disadvantage, d100, DiceRoller overlay). ✅ 5a. Quest Log, view side (persistent card panel). Plus unplanned-but-kept: end_session (0006), the v11 card-shell layout.

✅ 6. **Character commands**: the full mutation set — `adjustCharacterHp/Xp/Luck/Gold`, `addCharacterGear`/`removeCharacterGear`, `restCharacter` (all in `lib/characters.ts`) — surfaced as real edit affordances via `CharacterCommands.tsx`, mounted inside `CharacterSheet`. Acceptance criterion met: these write through the same command layer as everything else and echo to the journal.

✅ 9. **NPC / faction / treasure trackers**: `NpcCard`, `FactionCard`, `TreasureRow` all live, wired into `WorldTabs` alongside `npcStatBlocks`/`locationSecrets` maps — GM-secret data kept structurally separate from the public rows, same pattern used elsewhere in the app.

✅ 10. **Campaign search**: real client-side full-text token filter over the feed (`CampaignSearch.tsx`), not the disabled stub the original mockup shipped.

✅ 11. **AI GM in-app**: a full `gm_turn` edge function (`prompt.ts`/`context.ts`/`tools.ts`/`provider.ts`/`tts.ts`) with real tool-calling (`log_journal_entry`, `roll_dice`, `adjust_character_hp`, `propose_check`, `note_invention`), persona sourced from `system_packs`, GM budget tracking. Confirmed live and in active use this session (the Bell-Warden dungeon narration was this system, not a fixture).

✅ 12. **Character builder**: a real 7-step wizard (`CharacterBuilder.tsx`, 867 lines) — level, stats, ancestry, class, background, gear, review, with a zero-level branch that skips the class step per the real rule.

✅ 15. **GM prep + handouts** — all 4 slices shipped 2026-08-12 through 2026-08-14: Locations/Places tracker (`0024_locations`), threat/faction clocks, GM reference viewer (persona + house rules, reading real `system_packs` content), player-safe handout maps (`0026_map_handouts`, the first owner-gated action anywhere in the maps command layer). See `grimoire-phase15-gm-prep-handouts-scope.md` in the project for the full slice-by-slice writeup.

✅ 16. **Multiplayer, realtime + presence** (2026-08-14) — closes item 14's own gap, same day. `useCampaignRealtime` subscribes to `postgres_changes` on `sessions`/`characters`/`journal_entries` (added to the `supabase_realtime` publication in migration `0027`), scoped per campaign and upserted into the same state every RPC echo already writes into, so a second signed-in player now sees session start/pause/resume, character/HP updates, and new journal entries live, no refresh needed. `useCampaignPresence` tracks connected `campaign_members` on a Presence channel; `PlayerCard` shows a live online dot per character. Invites/roles (the rest of item 14) were already shipped — this was the one piece still missing, and the whole reason item 14 was only partially shipped. Deliberately scoped to the three tables a live session actually mutates during play, not every table `useJournalScreenData` loads (quests/NPCs/factions/treasure/notes/locations/clocks stay non-realtime, GM-curated content edited rarely — can be added the same way later if that changes).

✅ 17. **Session end-review** (2026-08-14) — closes item 7's own gap, same day as items 16/18. Stop Session now opens `EndSessionReview` instead of ending immediately: a read-only preview of this session's XP/gold/HP/gear changes (re-derived client-side from `campaign_events`, same event kinds and time window the server itself uses) plus a "next time" freeform textarea. Confirming calls `end_session` (migration `0028_session_recap.sql`) with that note; the RPC itself aggregates the same roll-up server-side — never trusting the client's preview — and writes one `system` journal entry combining the recap and the note, landing right where `JournalFeed`'s own per-session divider already puts it. `pauseSession`/`resumeSession`/`startSession` (all in `lib/campaigns.ts`) were already real and live in the header's session controls; end-session review was the one piece missing.

✅ 18. **Maps Scene tab** (2026-08-14) — closes item 8's own gap, same day. A standalone Close/Near/Far zone tracker (migration `0029_scene_positions.sql`, new `scene_positions` table + `set_scene_position`/`clear_scene` RPCs) replaces the honest "Scene (coming soon)" stub — one zone per active character, a `role="radiogroup"` pill picker matching `JournalComposer`'s own chip pattern, plus a "Clear scene" reset. Deliberately scoped independent of Encounter mode (item 13, still unbuilt) per a direct decision: real and usable today for tracking who's Close/Near/Far during any scene, not gated on initiative/monster cards/HP toggles landing first — a later Encounter-mode slice can build on this same table rather than replace it. Region and Site tabs were already real (uploaded map image, party-position pin, travel chips, item 15 slice 4's owner-only handouts); Scene was the one stub left.

✅ 13. **Encounter mode** (four phases, 2026-08-20 to 2026-08-21) — `InitiativeRing`, `MonsterCard`, and `EncounterControls` all real now, built on item 18's `scene_positions` table rather than replacing it. Phase 1: schema + `start_encounter`/`add_monster`/`roll_initiative`/`advance_turn`/`end_encounter` RPCs (migration `0031`). Phase 3: dying, stabilizing, and morale checks wired to the rules text that was previously reference-only (`resolve_dying_turn`/`resolve_stabilize_check`/`resolve_morale_check`, migration `0035`). Phase 4: all ten combat RPCs exposed as real AI GM tools in `gm_turn`'s `tools.ts`, so the AI GM can run a fight end to end, not just narrate around a human doing it manually. Full writeup: `grimoire-phase19-encounter-mode-scope.md`.

**NOT BUILT:** nothing — every item above is shipped as of 2026-08-21. Two persistence-gap fixes landed after this list closed (`adjust_gold`/`update_quest_status`, `adjust_xp`/`add_gear`/`remove_gear` — see the 2026-08-21 banner above) but those aren't new build-order items, they're bugfixes to item 6/11's own tool surface.

**What's actually next isn't on this list anymore.** A two-account playtest (mentioned below since 2026-08-14 and still not done) is the natural way to confirm items 14/16 and the new encounter tools all hold up together in a real session, but nothing here is blocking — this file exists to track build order, and the build order is complete.

## Domain component list

Built **on demand** — each component gets created the first time a slice needs it (per SPEC's shared-components rule: GM and player pages render the same component; pages control the data). Grouped by family:

- **People:** PlayerCard (name, class/level, HP, luck, light-carried, PC color), NpcCard (+ GM-secret section), HirelingRow (Rowan/Miri/Hester pattern: statline, wage, morale note), FactionCard.
- **Vitals & pressure:** StatTile / StatStrip (HP AC Gear Luck Torch), LightTracker (burning timers, who carries what), EffectChip (blessings, covenants, conditions — Madeera's Covenant pattern), ClockCard, ExplorationCounter (crawling rounds / encounter checks).
- **Journal:** LogEntryRow (kinds: narration / action / roll / note / system), RollResult (dice math, tabular numerals), SessionDivider, Composer, JournalFilterBar.
- **Quests & world:** QuestCard, ObjectiveChecklist, AgreementRow, TimelineEntry, LocationCard (town-directory pattern), MapViewer (image + fog), later ZoneScene (rings + tokens).
- **Sheets & content:** CharacterSheet (composite of the above), GearSlotGrid, SpellCard (success/lock cycle states), TalentRow, RulesReference reader (private PDFs).
- **Encounter:** InitiativeRing (clockwise, not ranked), MonsterCard (presence/HP visibility toggles), EncounterControls.
- **Structure:** CampaignCard (lobby), SessionHeader, EmptyState (with flavor text), skeleton loaders, ErrorBanner.

## The multi-system question (Mörk Borg some day?)

**Yes — it's achievable, and cheaply, IF the seams are cut now and the generalization is deferred.** The design:

**System-agnostic core (most of the app):** campaigns, membership, sessions, the journal, the event ledger, dice, quests/agreements, NPCs/factions, maps, handouts, timelines. Nothing in this list knows what game it's hosting — a Mörk Borg campaign journals, rolls, and tracks quests identically.

**Game system pack (the swappable part):** four pieces per system —
1. **Character schema**: what a character *is* — stats, resources, slots — defined as data, not hardcoded columns. Shadowdark: STR–CHA, HP/AC, luck, gear slots, torch. Mörk Borg: its four abilities, omens, powers, the Misery calendar. The StatStrip and PlayerCard render whatever the schema declares.
2. **Rules module**: creation, checks, advancement, rest — behind one interface, versioned (attempt 1 already proved this pattern with its versioned character-rules module). One module per system; nothing outside the module contains rules logic.
3. **Content pack**: classes, spells, monsters, tables as database rows tagged by system — and kept in private storage, because Shadowdark and Mörk Borg each have their own third-party license and neither's text belongs in a public repo.
4. **AI GM profile**: persona, protocol, and rules-reference set per system (the gm-brain pattern, parameterized).

**The three seams to cut NOW (cheap today, brutal to retrofit):**
- A `system` field on campaigns from the very first migration, even though it only ever says `shadowdark` for the next year.
- Character stats/resources stored as schema-validated JSON, not as forty hard columns named `torch_minutes`.
- Rules logic confined to the versioned rules module — never inlined in components, commands, or the AI GM prompt.

**What NOT to do:** build the generic engine first. Depth-first on Shadowdark with the seams in place beats designing an abstraction from one data point. When Mörk Borg day comes, it's a new pack — not a rewrite. (Wisdom borrowed from this project's own history: attempt 1's rejected microservices plan made the same over-generalization mistake in a different costume.)
