import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { ColumnCard } from '../ui/ColumnCard'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { JournalFeed } from './JournalFeed'
import { JournalFilterBar } from './JournalFilterBar'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalComposer } from './JournalComposer'
import { PlayerCard } from './PlayerCard'
import { WorldTabs } from './WorldTabs'
import { ToolsDock } from './ToolsDock'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { FeedItem } from '../../lib/feed'
import type { GmCheck, ResolveSource } from '../../lib/checks'
import type { GmTurnResult } from '../../lib/gm'
import type { CampaignSession, JournalEntry } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'
import type { Faction, Note, Npc, NpcStatBlock, Treasure, Location, LocationSecret, Clock } from '../../lib/world'

interface JournalDesktopLayoutProps {
  characters: Character[] | null
  /** Owner request, 2026-08-15 ("I think it need the same visual que on
   * desktop") — `MobileJournalView`'s own `activeCharacter` prop,
   * threaded down for the exact same reason: whether *any* active PC
   * exists yet (mine, else any other member's — same broad fallback
   * `JournalScreen`'s own doc comment on `activeCharacter` documents),
   * so the Party card below can swap its plain "+ New Character" button
   * for the same purple nudge treatment mobile shows on its home view
   * when this is null. Desktop has no separate "home slot" to put a
   * banner in the way mobile's tab system does — the Party card IS the
   * always-visible equivalent — so the nudge replaces that card's own
   * button rather than sitting in a second spot alongside it. */
  activeCharacter: Character | null
  /** BUILD_PLAN.md item 14 (realtime/presence, 2026-08-14) —
   * `useCampaignPresence`'s raw `Set<memberId>`, threaded straight
   * through to each `PlayerCard` below (matched there against
   * `character.member_id`) rather than narrowed here — this layout has
   * no reason to pre-compute per-character booleans `JournalScreen`
   * doesn't already need for anything else. Optional only because
   * `MobileJournalView`'s own copy of this same prop is (see that
   * file) — always passed a real (possibly empty) set from
   * `JournalScreen` in practice. */
  onlineMemberIds?: Set<string>
  /** Encounter mode phase 2 (BUILD_PLAN.md item 13, 2026-08-14) — same
   * "narrow before handing down" shape `onlineMemberIds` above already
   * established, just a single id instead of a set (only one combatant
   * is ever active at a time): the `character.id` of whichever
   * combatant `turn_order.active_index` currently points at, or `null`
   * if no encounter is running or a monster is active. Matched against
   * each `PlayerCard` below the same way `isOnline` already is. */
  activeTurnCharacterId: string | null
  quests: Quest[] | null
  /** BUILD_PLAN.md slice 9 (`WorldTabs`) — loaded alongside `quests` by
   * `useJournalScreenData`, threaded straight through the same way
   * `quests` already is. `npcStatBlocks` is empty for a non-owner viewer
   * (RLS-filtered server-side); see `WorldTabs`' own doc comment. */
  npcs: Npc[] | null
  factions: Faction[] | null
  treasure: Treasure[] | null
  /** `WorldTabs`' 5th tab (2026-08-10) — same load-up-front treatment as
   * `npcs`/`factions`/`treasure`. */
  notes: Note[] | null
  /** BUILD_PLAN.md item 15 slice 1 (2026-08-12) — same load-up-front
   * treatment as `npcs`/`factions`/`treasure`/`notes`. */
  locations: Location[] | null
  npcStatBlocks: Map<string, NpcStatBlock>
  locationSecrets: Map<string, LocationSecret>
  /** BUILD_PLAN.md item 15 slice 2 (2026-08-14) — same load-up-front
   * treatment as `locations`. `isOwner`/`reloadClocks` are new
   * alongside it: `WorldTabs` needs both to let the owner mutate clocks
   * in-app (see that component's own doc comment for why clocks are
   * the first WorldTabs table this is true for). `isOwner` reuses this
   * screen's own existing `campaign.owner === user.id` prop rather than
   * a second ownership check; `reloadClocks` is
   * `useJournalScreenData`'s targeted re-fetch. */
  clocks: Clock[] | null
  isOwner: boolean
  reloadClocks: () => Promise<void>
  sessions: CampaignSession[] | null
  entries: JournalEntry[] | null
  error: string | null
  onRetry: () => void
  activeFilters: Set<FilterKind>
  onToggleFilter: (kind: FilterKind) => void
  feedItems: FeedItem[]
  feedFilter: (item: FeedItem) => boolean
  openSession: CampaignSession | null
  /** Whether the open session is actually accepting play right now —
   * false both when there's no open session AND when there is one but
   * it's paused (2026-08-10). Everything that logs/spends the table's
   * turn (the composer, dice rolls, "save as note") gates on this, not
   * on `Boolean(openSession)` — a paused session is still `openSession`
   * (its id/number stay valid), it just isn't live play. */
  sessionActive: boolean
  /** Forwarded to `JournalComposer` purely for its placeholder copy
   * ("paused" vs. "no session yet") — the actual gate is `sessionActive`
   * above. */
  sessionPaused?: boolean
  onOpenCharacter: (character: Character) => void
  /** Opens `CharacterBuilder` (2026-08-11) — rendered as a plain button
   * inside the Party card, always available once `characters` has
   * loaded, party-empty or not (see this file's own doc comment on why
   * the Party card's mount condition changed to make that true). */
  onNewCharacter: () => void
  onOpenDice: () => void
  /** Slice 8 (Maps overlay) — threaded straight to `ToolsDock`, same as
   * `MobileJournalView`'s own copy of this prop. Not gated behind
   * `gmEnabled` (unlike `onOpenRules` below): Maps is campaign data any
   * member can view, not a GM-only feature. */
  onOpenMaps: () => void
  /** Slice 16 — threaded straight through to `JournalComposer`/
   * `JournalFilterBar`, same optional-and-off-by-default shape
   * `MobileJournalView` already takes for its own copy of this prop.
   * Slice 17: the caller now passes its own `gm_mode`-gated value here
   * (`aiGmActive` in `JournalScreen`), not the raw feature flag — this
   * component doesn't know or care about that distinction, it just
   * gates the same two things it always has. */
  gmEnabled?: boolean
  /** Pre-gated by the caller (`aiGmActive ? () => setRulesOpen(true) :
   * undefined`), same convention `MobileJournalView` already uses —
   * this component doesn't re-derive the gate itself. */
  onOpenRules?: () => void
  /** BUILD_PLAN.md item 15 slice 3 (2026-08-14) — threaded straight to
   * `ToolsDock`, same "always provided, not gated behind `gmEnabled`"
   * shape as `onOpenMaps` above, not `onOpenRules`: see `ToolsDock`'s
   * own doc comment on `onOpenGmReference` for why. */
  onOpenGmReference?: () => void
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Both picked up an optional `signal` param 2026-08-18 — pure
   * pass-through to `JournalComposer`'s new Stop button, same as
   * `useGmJournalHandlers.ts`'s own widened signature. This component
   * doesn't create or touch the signal itself. */
  onAskGm?: (input: string, signal?: AbortSignal) => Promise<GmTurnResult>
  onAskRules?: (input: string, signal?: AbortSignal) => Promise<GmTurnResult>
  /** Global voice switch (UI review slice A, 2026-08-16) — the pair now
   * feeds `JournalComposer`'s single `AiVoiceToggle` (the per-row pill
   * is gone), and `aiVoiceOn` alone is additionally forwarded to
   * `JournalFeed` as `voiceEnabled` so rows know whether to offer
   * read-aloud at all. See those components' own doc comments. */
  aiVoiceOn?: boolean
  onToggleAiVoice?: () => void
  /** Whether the voice tier exists in this build (`VITE_GM_TTS`) —
   * forwarded straight to `JournalComposer`'s Voice budget bar
   * (2026-08-10). Distinct from `aiVoiceOn` above: that's the player's
   * own on/off choice, this is the build's capability. */
  ttsAvailable?: boolean
  /** Slice 17: forwarded straight to `JournalFeed` — see its own doc
   * comment. Both optional, same "omit for read-only" convention every
   * other feed callback here already follows. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  resolvingCheckId?: string | null
  campaignId: string
  /** The campaign's system — threaded to every `PlayerCard` so party
   * stat labels speak the right game's language (owner: "separate
   * games using same interface"). */
  system?: string | null
}

/**
 * The `xl:` and up three-column grid — Party+Tools, the journal card,
 * Quest Log — split out of `JournalScreen.tsx` (that file was 460
 * lines, over CLAUDE.md's ~300-line cap; BOB_fixes.md's recommended
 * cut). Extraction only, not a redesign: every prop here is exactly
 * what the JSX already closed over before the split, just threaded
 * explicitly instead of reaching into `JournalScreen`'s own scope.
 *
 * `MobileJournalView` is this component's sibling for the same split —
 * `JournalScreen` now owns state + handlers and mounts one or the
 * other (both, actually; Tailwind's `xl:` classes pick which one is
 * visible, matching every other responsive decision in this app), so
 * neither layout is hand-built twice against drifting copies of the
 * same data.
 */
export function JournalDesktopLayout({
  characters,
  activeCharacter,
  onlineMemberIds,
  activeTurnCharacterId,
  quests,
  npcs,
  factions,
  treasure,
  notes,
  locations,
  npcStatBlocks,
  locationSecrets,
  clocks,
  isOwner,
  reloadClocks,
  sessions,
  entries,
  error,
  onRetry,
  activeFilters,
  onToggleFilter,
  feedItems,
  feedFilter,
  // openSession stays in the props interface (callers still pass it;
  // removing it there is an API change) but is no longer destructured —
  // sessionActive/sessionPaused superseded it here, and the unused
  // binding was one of the errors keeping CI red (TS6133).
  sessionActive,
  sessionPaused,
  onOpenCharacter,
  onNewCharacter,
  onOpenDice,
  onOpenMaps,
  gmEnabled,
  onOpenRules,
  onOpenGmReference,
  onLog,
  onAskGm,
  onAskRules,
  aiVoiceOn,
  onToggleAiVoice,
  ttsAvailable,
  onResolveCheck,
  resolvingCheckId,
  campaignId,
  system,
}: JournalDesktopLayoutProps) {
  // "Save as note" quick action (2026-08-09): local to this layout, not
  // lifted to JournalScreen — JournalDesktopLayout and MobileJournalView
  // are both always-mounted siblings (Tailwind's `xl:` classes just
  // toggle which one is visible), so each keeps its own independent
  // seed state rather than sharing one the other could stomp.
  const [noteSeed, setNoteSeed] = useState<{ body: string } | null>(null)
  return (
    // Right column widened 20rem -> 26rem (2026-08-10, owner: "widen quest
    // log panel so the top nav fits") — WorldTabs' tab row (Quests/People/
    // Factions/Loot) plus ColumnCard's own p-3 padding was tighter than
    // comfortable at 20rem even with the shortened variant-C labels.
    // Left column widened 16rem -> 18rem, same day, same reasoning (owner:
    // "expand the party frame so the gold can fit on the same line as the
    // other stats") — PlayerCard's stat row (HP/AC/BAG/GP) was wrapping
    // GP onto its own line at 16rem once a character had gear-slot data to
    // show alongside HP/AC.
    // Left column widened again 18rem -> 20rem (2026-08-14, owner: "widen
    // the party panel so luck is not on a line by itself") — migration
    // 0022's LUCK stat (added to PlayerCard's statSpans alongside HP/AC/
    // BAG/GP) reintroduced the exact same wrapping problem one stat later;
    // same fix, same column. The center journal's minmax(0,1fr) is
    // unchanged; both side columns' extra width comes entirely out of its
    // flexible share.
    // Party column 20rem -> 22rem (2026-08-16, owner: "expand party
    // panel so luck never wraps") — five stat spans (HP/AC/BAG/GP/LUCK)
    // sat right at 20rem's edge, so a character with wider numerals
    // (10/10) pushed LUCK onto its own line while a narrower one
    // didn't; +2rem clears the widest real row with room.
    <div className="hidden flex-1 grid-cols-1 gap-3 p-4 xl:grid xl:min-h-0 xl:grid-cols-[22rem_minmax(0,1fr)_26rem]">
      {/* LEFT: Party card + Tools card (v11: members grouped in one
        * card, tools in their own card below it) — each a ColumnCard,
        * the card-shell layout primitive (CLAUDE.md). */}
      {/* 2026-08-11: was gated on `characters.length > 0` — which hid
        * the Party card, and with it the only way to reach the new
        * Character Builder, on any campaign with an empty party (every
        * brand-new campaign, by definition). Gating on `!== null`
        * alone keeps the card mounted once the load resolves either
        * way, with a real `EmptyState` standing in for the PlayerCard
        * list when there's nothing to show yet — was a bare caption
        * line until a visual review caught the mismatch with
        * `MobileJournalView`'s own Party tab (which already used
        * `EmptyState` here) and with `WorldTabs`, which already nests
        * `EmptyState` inside this same desktop grid's Quest Log
        * `ColumnCard` (2026-08-11 fix, same copy as the mobile copy). */}
      {characters !== null && (
        <div className="flex min-h-0 flex-col gap-3">
          <ColumnCard headerLeft="Party" bodyClassName="gap-2" className="xl:flex-1">
            {characters.map((character) => (
              <PlayerCard
                system={system}
                key={character.id}
                character={character}
                onClick={() => onOpenCharacter(character)}
                isOnline={character.member_id != null && (onlineMemberIds?.has(character.member_id) ?? false)}
                isActiveTurn={character.id === activeTurnCharacterId}
              />
            ))}
            {characters.length === 0 && (
              <EmptyState icon="party" title="No party yet" description="Characters you add to this campaign show up here." />
            )}
            {/* Owner request, 2026-08-15 ("I think it need the same
              * visual que on desktop") — same purple nudge treatment
              * `MobileJournalView`'s home view shows when
              * `activeCharacter` is null, copy included, in place of
              * the plain dashed button below (not alongside it — this
              * card is already the always-visible equivalent of
              * mobile's separate home-view slot, so one CTA here does
              * both jobs). Once a real active character exists, this
              * reverts to the ordinary dashed button for adding
              * further party members, same as it always has. */}
            {activeCharacter === null ? (
              <button
                type="button"
                onClick={onNewCharacter}
                className="flex items-center justify-between gap-3 rounded-card border border-purple/35 bg-purple/10 px-4 py-3 text-left"
              >
                <span>
                  <span className={cx(text.label, 'block text-purple')}>No character yet</span>
                  <span className={cx(text.caption, 'mt-0.5 block text-ink-faint')}>Tap to create one and join the party.</span>
                </span>
                <span className={cx(text.label, 'shrink-0 text-purple')}>+ New Character</span>
              </button>
            ) : (
              <Button type="button" variant="dashed" onClick={onNewCharacter}>+ New Character</Button>
            )}
          </ColumnCard>
          <ColumnCard headerLeft="Tools">
            <ToolsDock onOpenDice={onOpenDice} diceDisabled={!sessionActive} onOpenRules={onOpenRules} onOpenMaps={onOpenMaps} onOpenGmReference={onOpenGmReference} />
          </ColumnCard>
        </div>
      )}

      {/* CENTER: the journal card — sticky header, internally
        * scrolling feed, composer pinned to the card's foot.
        * BOB_queue task 1, final placement (owner: "make the filters
        * smaller and put it in the header"): JournalFilterBar rides
        * ColumnHeader's right slot as compact chips. It briefly held
        * a pinned subheader strip of its own — and before that
        * shipped invisible inside the scrolling body — but the
        * header slot kills the extra row AND the visual "same chips
        * twice" confusion with the composer's kind pickers in one
        * move. Gated on the same loaded state as the feed so chips
        * don't render over the skeleton.
        *
        * headerLeft is a plain static "Journal" now (2026-08-14,
        * header rework round 3) -- it used to be the dynamic
        * journalColumnLabel (session title, or "<mode> · Session N" as
        * a fallback), but JournalHeader shows that same session meta
        * itself now, right under the campaign name. Showing it a
        * second time here was the exact duplication an owner note
        * flagged; this card just names what it is, like its Party/
        * Tools siblings already do. */}
      <ColumnCard
        headerLeft="Journal"
        headerRight={
          sessions !== null && entries !== null ? (
            <JournalFilterBar compact active={activeFilters} onToggle={onToggleFilter} showRules={gmEnabled} />
          ) : undefined
        }
        bodyClassName="gap-3"
        footer={
          <JournalComposer
            onLog={onLog}
            sessionOpen={sessionActive}
            sessionPaused={sessionPaused}
            gmEnabled={gmEnabled}
            onAskGm={onAskGm}
            onAskRules={onAskRules}
            campaignId={campaignId}
            ttsAvailable={ttsAvailable}
            aiVoiceOn={aiVoiceOn}
            onToggleAiVoice={onToggleAiVoice}
            seed={noteSeed}
          />
        }
      >
        {error && <ErrorBanner onRetry={onRetry}>{error}</ErrorBanner>}

        {(sessions === null || entries === null || characters === null || quests === null) && !error && (
          <SkeletonGroup label="Loading journal" className="gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SkeletonGroup>
        )}

        {sessions !== null && entries !== null && (
          <JournalFeed
            items={feedItems}
            sessions={sessions}
            filter={feedFilter}
            onSaveAsNote={sessionActive ? (item) => setNoteSeed({ body: item.body }) : undefined}
            voiceEnabled={aiVoiceOn}
            onResolveCheck={onResolveCheck}
            resolvingCheckId={resolvingCheckId}
          />
        )}
      </ColumnCard>

      {/* RIGHT: Quest Log card — same shell, independent scroll. Slice 9
        * v2 (2026-08-10, owner's redirect from a separate World overlay):
        * NPCs/Factions/Treasure are three more tabs here rather than a
        * second click-to-open surface — `WorldTabs` owns the tab row and
        * the scrolling list as one self-contained unit; this card just
        * gives it a bounded height to fill. The header's old "N Quests"
        * count is gone rather than made tab-aware: it was a single-slot
        * `headerRight` the parent controls, and `WorldTabs` owns tab
        * state internally (see its own doc comment for why), so there's
        * no clean way for this card to know which tab is active without
        * lifting that state back out — not worth it for a count. Shown
        * whenever any of the four lists has loaded, not gated on quests
        * specifically being non-empty like the old quests-only panel
        * was — a campaign with NPCs but no quests yet should still see
        * this card. */}
      {/* "Quest Log" -> "World" (UI review slice C, 2026-08-16): seven
        * tabs of NPCs/factions/places/clocks outgrew the old name —
        * it's a world browser, and the header should say so. */}
      {quests !== null && npcs !== null && factions !== null && treasure !== null && notes !== null && locations !== null && clocks !== null && (
        <ColumnCard headerLeft="World" bodyClassName="gap-0">
          <WorldTabs
            quests={quests}
            npcs={npcs}
            factions={factions}
            treasure={treasure}
            notes={notes}
            locations={locations}
            npcStatBlocks={npcStatBlocks}
            locationSecrets={locationSecrets}
            clocks={clocks}
            isOwner={isOwner}
            reloadClocks={reloadClocks}
            campaignId={campaignId}
            className="min-h-0 flex-1"
          />
        </ColumnCard>
      )}
    </div>
  )
}
