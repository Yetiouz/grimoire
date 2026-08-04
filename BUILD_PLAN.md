# Grimoire — Build Order, Components, and the Multi-System Question

*Derived Aug 4 2026 from the full Shadowdark collection (core V4-9, Quickstart, Cursed Scrolls 1–3, Mini Adventures, Shadowdome) and — most importantly — the live file-based campaign system in `_CAMPAIGNS/`, especially The Black Road. Companion to SPEC.md; where they conflict, SPEC.md wins after discussion.*

## The governing insight

The user already runs a complete campaign-management system today: markdown files + a tracker spreadsheet, maintained by hand between chat sessions (`campaign-state.md`, `timeline.md`, `quest-log.md`, `npc-log.md`, `objective-list.md`, `tracker.xlsx`, character sheets, maps, plus shared GM persona / house rules / session protocol). **Grimoire's Milestone 1 is, concretely, replacing those files** — every slice below exists because a file in that folder proves the need is real. The Black Road is also *designed* to grow from a solo prologue into a three-player family campaign — which is exactly Grimoire's Milestone 2 (friends join). The campaign and the app are on converging paths.

## Build order

Ordered so each slice replaces a real file the user maintains by hand today, and each is independently useful the week it ships.

1. **Campaign core + journal + event ledger** *(already planned — the current slice)*. Campaign entity, journal entries by kind (narration / action / roll / note / system), composer, session dividers. The ledger underneath from day one.
2. **The Black Road import.** One-time migration of the active campaign into Grimoire: state snapshot, timeline entries as journal sessions, the three characters, quests/objectives. From this day the app has real data, gets used every session, and every annoyance found in play becomes the next slice's spec. Highest-leverage slice on this list.
3. **Character sheet (read + command-driven updates) and the stat strip.** What `characters/*.md` and the roster hold today: abilities, HP/AC/XP/coin, gear, talents, blessings/covenants, hirelings' stat lines. View first; every mutation through ledger commands (HP, XP, coin, rests).
4. **Server-authoritative dice.** Replaces `_TOOLS/dice.py` and the dice-integrity rules in the GM persona: app-rolled dice land in the journal as roll entries with visible math; "player always rolls their own checks" becomes enforced structure.
5. **Quests, objectives, and agreements.** Replaces `quest-log.md` + `objective-list.md` + the "accepted agreements" section of campaign-state: quest cards with status, a player-facing objective checklist, agreement records (who owes what — the Mara Venn pattern).
6. **NPC / faction / treasure trackers.** Replaces `npc-log.md` and `tracker.xlsx` (its sheets: PC roster, NPCs, factions, treasure & magic items, session index). GM-secret fields separated from player-visible data at the schema level (attempt-1 lesson).
7. **Session lifecycle.** Replaces `SESSION_PROTOCOL.md`'s checklists: session open/close, end-session review (XP, treasure, next-pickup note), and the "current snapshot" auto-derived from the ledger instead of hand-written.
8. **AI GM in-app.** The gm-brain files (GM persona, house rules, session protocol) become the AI GM's instruction base; it plays through the same validated commands as a human, writing narration into the journal it already lives in. Rules reference comes from the user's purchased PDFs in private storage (`rule_documents`), never from the public repo.
9. **Character builder.** Guided creation for the family campaign's new players. Late because current characters arrive via import (slice 2), so nothing blocks on it.
10. **Encounter mode + zone scenes.** Initiative (clockwise), Close/Near/Far zone rings over scene art, monster visibility toggles, dying/stabilizing/morale — the locked design decisions from SPEC.
11. **Multiplayer.** Invites, roles, presence, realtime sync. This is when Constantine's and LaLa's players join The Black Road for real. The two-account playtest checklist from attempt 1 is the acceptance gate.
12. **GM prep + handouts.** Adventure workspace, map management, handouts — the Cursed Scroll adventures and their maps are the content this serves.

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
