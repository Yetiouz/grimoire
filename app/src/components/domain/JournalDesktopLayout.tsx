import { useState } from 'react'
import { ColumnCard } from '../ui/ColumnCard'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { text } from '../../lib/typography'
import { JournalFeed } from './JournalFeed'
import { JournalFilterBar } from './JournalFilterBar'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalComposer } from './JournalComposer'
import { PlayerCard } from './PlayerCard'
import { QuestLogPanel } from './QuestLogPanel'
import { ToolsDock } from './ToolsDock'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { FeedItem } from '../../lib/feed'
import type { GmTurnResult } from '../../lib/gm'
import type { CampaignSession, JournalEntry } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'

interface JournalDesktopLayoutProps {
  characters: Character[] | null
  quests: Quest[] | null
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
  /** Slice 16 — threaded straight through to `JournalComposer`/
   * `JournalFilterBar`, same optional-and-off-by-default shape
   * `MobileJournalView` already takes for its own copy of this prop. */
  gmEnabled?: boolean
  /** Pre-gated by the caller (`gmEnabled ? () => setRulesOpen(true) :
   * undefined`), same convention `MobileJournalView` already uses —
   * this component doesn't re-derive the gate itself. */
  onOpenRules?: () => void
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  onAskGm?: (input: string) => Promise<GmTurnResult>
  onAskRules?: (input: string) => Promise<GmTurnResult>
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
  gmEnabled,
  onOpenRules,
  onLog,
  onAskGm,
  onAskRules,
  campaignId,
}: JournalDesktopLayoutProps) {
  // "Save as note" quick action (2026-08-09): local to this layout, not
  // lifted to JournalScreen — JournalDesktopLayout and MobileJournalView
  // are both always-mounted siblings (Tailwind's `xl:` classes just
  // toggle which one is visible), so each keeps its own independent
  // seed state rather than sharing one the other could stomp.
  const [noteSeed, setNoteSeed] = useState<{ body: string } | null>(null)
  return (
    <div className="hidden flex-1 grid-cols-1 gap-3 p-4 xl:grid xl:min-h-0 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
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
            <ToolsDock onOpenDice={onOpenDice} diceDisabled={!openSession} onOpenRules={onOpenRules} />
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
          />
        )}
      </ColumnCard>

      {/* RIGHT: quest card — same shell, independent scroll. */}
      {quests !== null && quests.length > 0 && (
        <ColumnCard
          headerLeft="Quest Log"
          headerRight={
            <span className={text.label}>
              {quests.length} {quests.length === 1 ? 'Quest' : 'Quests'}
            </span>
          }
          bodyClassName="gap-2"
        >
          <QuestLogPanel quests={quests} />
        </ColumnCard>
      )}
    </div>
  )
}
