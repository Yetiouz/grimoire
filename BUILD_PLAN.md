# Grimoire — Build Order, Components, and the Multi-System Question

*Derived Aug 4 2026 from the full Shadowdark collection (core V4-9, Quickstart, Cursed Scrolls 1–3, Mini Adventures, Shadowdome) and — most importantly — the live file-based campaign system in `_CAMPAIGNS/`, especially The Black Road. Companion to SPEC.md; where they conflict, SPEC.md wins after discussion.*

## The governing insight

The user already runs a complete campaign-management system today: markdown files + a tracker spreadsheet, maintained by hand between chat sessions (`campaign-state.md`, `timeline.md`, `quest-log.md`, `npc-log.md`, `objective-list.md`, `tracker.xlsx`, character sheets, maps, plus shared GM persona / house rules / session protocol). **Grimoire's Milestone 1 is, concretely, replacing those files** — every slice below exists because a file in that folder proves the need is real. The Black Road is also *designed* to grow from a solo prologue into a three-player family campaign — which is exactly Grimoire's Milestone 2 (friends join). The campaign and the app are on converging paths.

## Build order

Ordered so each slice replaces a real file the user maintains by hand today, and each is independently useful the week it ships.

**SHIPPED (Aug 4–5, 2026):** ✅ 1. Campaign core + journal + event ledger (migrations 0001–0003, five-kind taxonomy incl. chat). ✅ 2. The Black Road import (0004 — 144 entries, 3 PCs, 17 NPCs, 7 quests, 13 treasure items, live). ✅ 3a. Characters, view side (PlayerCard + CharacterSheet overlay, real colors via 0005). ✅ 4. Server-authoritative dice (0007–0008: roll_dice, advantage/disadvantage, d100, DiceRoller overlay). ✅ 5a. Quest Log, view side (persistent card panel). Plus unplanned-but-kept: end_session (0006), the v11 card-shell layout. The app is in daily solo use.

**REMAINING, in order — each slice still gets a plan gate before build:**

6. **Character commands** (next; completes old slice 3): the mutation half — adjust HP/XP/coin, gear add/remove, full rest — as SECURITY DEFINER commands writing ledger events, surfaced as edit affordances in CharacterSheet and echoed to the journal as system entries. Acceptance: a full rest at the end of a real session updates Kimbo's sheet and appears in the log without touching markdown.
7. **Session states + lifecycle** (absorbs the v11 pause stub): a real `paused` state (schema + commands), then end-session review — XP/treasure summary and a "next pickup" note derived from the ledger, replacing SESSION_PROTOCOL.md's checklist.
8. **Maps overlay** (v11's Maps tool): Region tab first — uploaded map image, party-position pin, travel chips (pace, hexes remaining); Site and Scene tabs stub. Private storage per licensing rules.
9. **NPC / faction / treasure trackers**: surface the already-imported tables (17 NPCs are in the database with no UI); GM-secret fields separated at the schema level.
10. **Campaign search** (the top-bar pill goes live): full-text over journal entries first — highest value per line of code once entries number in the hundreds.
11. **AI GM in-app**: gm-brain persona through the same commands; narration into the journal. The summit of Milestone 1.
12. **Character builder** — for the family campaign's new players.
13. **Encounter mode + zone scenes**: initiative order on the party rail (cards reorder, active glows, round chip — the rail was built for this), dying/stabilizing timers on PlayerCard down-states, Close/Near/Far scene tab.
14. **Multiplayer**: invites, roles, presence, realtime. Constantine's and LaLa's players join for real; two-account playtest is the gate.
15. **GM prep + handouts.** Broken into 4 independent slices (see `grimoire-phase15-gm-prep-handouts-scope.md` in the project): Locations/Places tracker, threat/faction clocks, GM reference (persona + house rules), player-safe handout maps. Slice 1 (Locations/Places, migration `0024_locations`) shipped 2026-08-12. The other 3 are still ahead.

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
