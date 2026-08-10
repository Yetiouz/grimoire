import { useState } from 'react'
import { ColumnCard } from '../ui/ColumnCard'
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
import type { Faction, Note, Npc, NpcStatBlock, Treasure } from '../../lib/world'

interface JournalDesktopLayoutProps {
  characters: Character[] | null
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
  npcStatBlocks: Map<string, NpcStatBlock>
  sessions: CampaignSession[] | null
  entries: JournalEntry[] | null
  error: string | null
  onRetry: () => void
  journalColumnLabel: string
  activeFilters: Set<FilterKind>
  onToggleFilter: (kind: FilterKind) => void
  feedItems: FeedItem[]
  feedFilter: (item: FeedItem) => boolean
  openSession: CampaignSession | null
  onOpenCharacter: (character: Character) => void
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
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  onAskGm?: (input: string) => Promise<GmTurnResult>
  onAskRules?: (input: string) => Promise<GmTurnResult>
  /** Slice 17: forwarded straight to `JournalFeed` — see its own doc
   * comment. Both optional, same "omit for read-only" convention every
   * other feed callback here already follows. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  resolvingCheckId?: string | null
  campaignId: string
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
  quests,
  npcs,
  factions,
  treasure,
  notes,
  npcStatBlocks,
  sessions,
  entries,
  error,
  onRetry,
  journalColumnLabel,
  activeFilters,
  onToggleFilter,
  feedItems,
  feedFilter,
  openSession,
  onOpenCharacter,
  onOpenDice,
  onOpenMaps,
  gmEnabled,
  onOpenRules,
  onLog,
  onAskGm,
  onAskRules,
  onResolveCheck,
  resolvingCheckId,
  campaignId,
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
    // comfortable at 20rem even with the shortened variant-C labels. Left
    // column and the center journal's minmax(0,1fr) are unchanged; the
    // extra width comes entirely out of the center column's flexible share.
    <div className="hidden flex-1 grid-cols-1 gap-3 p-4 xl:grid xl:min-h-0 xl:grid-cols-[16rem_minmax(0,1fr)_26rem]">
      {/* LEFT: Party card + Tools card (v11: members grouped in one
        * card, tools in their own card below it) — each a ColumnCard,
        * the card-shell layout primitive (CLAUDE.md). */}
      {characters !== null && characters.length > 0 && (
        <div className="flex min-h-0 flex-col gap-3">
          <ColumnCard headerLeft="Party" bodyClassName="gap-2" className="xl:flex-1">
            {characters.map((character) => (
              <PlayerCard key={character.id} character={character} onClick={() => onOpenCharacter(character)} />
            ))}
          </ColumnCard>
          <ColumnCard headerLeft="Tools">
            <ToolsDock onOpenDice={onOpenDice} diceDisabled={!openSession} onOpenRules={onOpenRules} onOpenMaps={onOpenMaps} />
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
        * don't render over the skeleton. */}
      <ColumnCard
        headerLeft={journalColumnLabel}
        headerRight={
          sessions !== null && entries !== null ? (
            <JournalFilterBar compact active={activeFilters} onToggle={onToggleFilter} showRules={gmEnabled} />
          ) : undefined
        }
        bodyClassName="gap-3"
        footer={
          <JournalComposer
            onLog={onLog}
            sessionOpen={Boolean(openSession)}
            gmEnabled={gmEnabled}
            onAskGm={onAskGm}
            onAskRules={onAskRules}
            campaignId={campaignId}
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
            onSaveAsNote={openSession ? (item) => setNoteSeed({ body: item.body }) : undefined}
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
      {quests !== null && npcs !== null && factions !== null && treasure !== null && notes !== null && (
        <ColumnCard headerLeft="Quest Log" bodyClassName="gap-0">
          <WorldTabs
            quests={quests}
            npcs={npcs}
            factions={factions}
            treasure={treasure}
            notes={notes}
            npcStatBlocks={npcStatBlocks}
            className="min-h-0 flex-1"
          />
        </ColumnCard>
      )}
    </div>
  )
}
