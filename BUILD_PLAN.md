# Grimoire — Build Order, Components, and the Multi-System Question

*Derived Aug 4 2026 from the full Shadowdark collection (core V4-9, Quickstart, Cursed Scrolls 1–3, Mini Adventures, Shadowdome) and — most importantly — the live file-based campaign system in `_CAMPAIGNS/`, especially The Black Road. Companion to SPEC.md; where they conflict, SPEC.md wins after discussion.*

## The governing insight

The user already runs a complete campaign-management system today: markdown files + a tracker spreadsheet, maintained by hand between chat sessions (`campaign-state.md`, `timeline.md`, `quest-log.md`, `npc-log.md`, `objective-list.md`, `tracker.xlsx`, character sheets, maps, plus shared GM persona / house rules / session protocol). **Grimoire's Milestone 1 is, concretely, replacing those files** — every slice below exists because a file in that folder proves the need is real. The Black Road is also *designed* to grow from a solo prologue into a three-player family campaign — which is exactly Grimoire's Milestone 2 (friends join). The campaign and the app are on converging paths.

## Build order

Ordered so each slice replaces a real file the user maintains by hand today, and each is independently useful the week it ships.

**Status refreshed 2026-08-14** by a full code-level audit (this banner and the list below had drifted badly out of sync with what's actually shipped — items 6 through 12 were still marked "remaining" despite being built weeks ago; nobody had come back to check them off). Audit method: grep the real source for each item's described RPCs/components, read the call sites, and for the highest-uncertainty ones (AI GM) cross-check against what was actually observed live in the browser this session. Every claim below is grounded in a specific file, not a guess.

**SHIPPED:**

✅ 1. Campaign core + journal + event ledger (migrations 0001–0003, five-kind taxonomy incl. chat). ✅ 2. The Black Road import (0004 — 144 entries, 3 PCs, 17 NPCs, 7 quests, 13 treasure items, live). ✅ 3a. Characters, view side (PlayerCard + CharacterSheet overlay, real colors via 0005). ✅ 4. Server-authoritative dice (0007–0008: roll_dice, advantage/disadvantage, d100, DiceRoller overlay). ✅ 5a. Quest Log, view side (persistent card panel). Plus unplanned-but-kept: end_session (0006), the v11 card-shell layout.

✅ 6. **Character commands**: the full mutation set — `adjustCharacterHp/Xp/Luck/Gold`, `addCharacterGear`/`removeCharacterGear`, `restCharacter` (all in `lib/characters.ts`) — surfaced as real edit affordances via `CharacterCommands.tsx`, mounted inside `CharacterSheet`. Acceptance criterion met: these write through the same command layer as everything else and echo to the journal.

✅ 9. **NPC / faction / treasure trackers**: `NpcCard`, `FactionCard`, `TreasureRow` all live, wired into `WorldTabs` alongside `npcStatBlocks`/`locationSecrets` maps — GM-secret data kept structurally separate from the public rows, same pattern used elsewhere in the app.

✅ 10. **Campaign search**: real client-side full-text token filter over the feed (`CampaignSearch.tsx`), not the disabled stub the original mockup shipped.

✅ 11. **AI GM in-app**: a full `gm_turn` edge function (`prompt.ts`/`context.ts`/`tools.ts`/`provider.ts`/`tts.ts`) with real tool-calling (`log_journal_entry`, `roll_dice`, `adjust_character_hp`, `propose_check`, `note_invention`), persona sourced from `system_packs`, GM budget tracking. Confirmed live and in active use this session (the Bell-Warden dungeon narration was this system, not a fixture).

✅ 12. **Character builder**: a real 7-step wizard (`CharacterBuilder.tsx`, 867 lines) — level, stats, ancestry, class, background, gear, review, with a zero-level branch that skips the class step per the real rule.

✅ 15. **GM prep + handouts** — all 4 slices shipped 2026-08-12 through 2026-08-14: Locations/Places tracker (`0024_locations`), threat/faction clocks, GM reference viewer (persona + house rules, reading real `system_packs` content), player-safe handout maps (`0026_map_handouts`, the first owner-gated action anywhere in the maps command layer). See `grimoire-phase15-gm-prep-handouts-scope.md` in the project for the full slice-by-slice writeup.

**PARTIALLY SHIPPED — the audit found real work done, but also a real gap left in the same item:**

🟡 7. **Session states + lifecycle**: the `paused` state is real and fully wired (`pauseSession`/`resumeSession`/`endSession`/`startSession` all in `lib/campaigns.ts`, all live in the header's session controls). **Still missing:** end-session review — `handleEndSession` just calls the RPC and updates state; there's no XP/treasure summary or "next pickup" note anywhere. SESSION_PROTOCOL.md's checklist still isn't replaced.

🟡 8. **Maps overlay**: Region and Site tabs are both real — uploaded map image, party-position pin (`MapPositionSidebar`/`MapPin`), pace + hexes-remaining travel chips, and (new as of item 15 slice 4) owner-only handout maps for players. **Still missing:** the Scene tab is an honest, labeled stub (`live: false`, "Scene (coming soon)") — no Close/Near/Far scene view exists.

🟡 14. **Multiplayer**: invites and roles are real and working (join-by-code, owner/player role enforced via RLS throughout — confirmed live this session via the header's Invite flow). **Still missing:** presence and realtime sync — there is no `supabase.channel()`, `postgres_changes` subscription, or presence tracking anywhere in the codebase. The whole app runs on "echo what the RPC returned," which means a second signed-in player would not see another player's live actions without refreshing the page. This is the one gap in this section worth flagging as higher-stakes than the others: the family-campaign milestone (Constantine's and LaLa's players joining for real) explicitly depends on this, and a two-account playtest would surface it immediately.

**NOT BUILT — confirmed still open, matches the original claim:**

⬜ 13. **Encounter mode + zone scenes**: no `InitiativeRing`, `MonsterCard`, or `EncounterControls` component exists. `PlayerCard.tsx`'s own comments say as much directly — initiative order "needs data from the (unbuilt) Encounter slice," and the down-state timer "needs stabilize-DC/rounds-remaining data this schema doesn't carry." The Close/Near/Far scene tab is the same stub noted under item 8. Dying/last-stand *rules text* exists as reference content (`lib/rules/shadowdark.ts`) but nothing mechanical is wired to it.

**Suggested order for what's left**, not a hard requirement: item 14's realtime/presence gap is the one with a real milestone riding on it (the family campaign can't actually go multiplayer without it) and is probably worth the next plan gate. Items 7 and 8's remaining halves are each small, self-contained, and could slot in around it. Item 13 (Encounter mode) is the biggest remaining lift and was always sequenced last for a reason — worth keeping it there rather than pulling it forward.

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
