import { useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { MobileTabBar } from '../ui/MobileTabBar'
import type { MobileView } from '../ui/MobileTabBar'
import { JournalFeed } from './JournalFeed'
import { JournalFilterBar } from './JournalFilterBar'
import { ALL_FILTER_KINDS } from '../../lib/journalFilters'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalComposer } from './JournalComposer'
import { PlayerCard } from './PlayerCard'
import { QuestLogPanel } from './QuestLogPanel'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { GmTurnResult } from '../../lib/gm'
import type { FeedItem } from '../../lib/feed'
import type { CampaignSession } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'

interface MobileJournalViewProps {
  loading: boolean
  activeCharacter: Character | null
  characters: Character[]
  quests: Quest[]
  sessions: CampaignSession[]
  /** BOB_queue task 1: the already-merged, already-sorted feed — see
   * lib/feed.ts's buildFeed(). Was `entries: JournalEntry[]` before
   * this task; JournalScreen now builds this once (useJournalFeed) and
   * hands the same array to both the desktop panel and here. */
  items: FeedItem[]
  sessionOpen: boolean
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Slice 16 — handed straight through to `JournalComposer`. Both
   * optional, so the mobile shell is completely unaffected while the
   * GM is off (which is the default). */
  gmEnabled?: boolean
  onAskGm?: (input: string) => Promise<GmTurnResult>
  /** BOB_queue task 1 fold-in: this was accepted as a prop already but
   * never declared here or threaded to JournalComposer below, so "Ask
   * Rules" was reachable on mobile but silently fell through to logging
   * the raw question as a journal entry instead. Fixed alongside the
   * rest of this task since both files were already open for it. */
  onAskRules?: (input: string) => Promise<GmTurnResult>
  campaignId?: string
  /** Slice 16 — opens the rules transcript from the Tools tile. */
  onOpenRules?: () => void
  onOpenCharacter: (character: Character) => void
  onOpenDice: () => void
}

/** Titles for the view header below. Tapping the lit tab again also
 * returns home, but that gesture is invisible — every non-journal view
 * gets a labelled header with a real close control so there is always
 * a visible way back to the journal (owner's call). */
const VIEW_TITLES: Record<MobileView, string> = {
  party: 'Party',
  maps: 'Maps',
  quests: 'Quest Log',
  tools: 'Tools',
}

const TOOL_TILES: Array<{ icon: IconName; label: string }> = [
  { icon: 'rules', label: 'Rules' },
  { icon: 'search', label: 'Search' },
  { icon: 'settings', label: 'Campaign' },
  { icon: 'world', label: 'World' },
]

function ToolTile({ icon, label, onClick }: { icon: IconName; label: string; onClick?: () => void }) {
  const live = Boolean(onClick)
  return (
    <button
      type="button"
      disabled={!live}
      onClick={onClick}
      title={live ? label : `${label} (coming soon)`}
      aria-label={live ? label : `${label} (coming soon)`}
      className={cx(
        'flex aspect-square flex-col items-center justify-center gap-2 rounded-card border border-line bg-panel',
        live ? 'text-ink-dim hover:border-line-hover hover:text-ink' : 'text-ink-dim opacity-50',
      )}
    >
      <Icon name={icon} />
      <span className={text.label}>{label}</span>
    </button>
  )
}

/**
 * The mobile layout slice's shell, mounted by `JournalScreen` below
 * `xl:` in place of the desktop three-column grid. Owns which tab is
 * showing (`activeView`, `null` = journal/home — per the mobile-vision
 * entry, "journal is home; there is no Journal tab") and renders the
 * matching content, with `MobileTabBar` pinned at the foot.
 *
 * Pulled into its own file rather than living inline in
 * `JournalScreen.tsx`: CLAUDE.md's ~300-line component cap. All of the
 * actual view content is existing components reused as-is
 * (`PlayerCard`, `QuestLogPanel`, `JournalFeed`/`JournalComposer`) —
 * this file is the tab-driven switch between them plus the two views
 * that don't exist anywhere yet (Maps, Tools), both rendered honestly
 * rather than with fabricated data: Maps is a real `EmptyState` (no
 * hex/travel data model exists to show), Tools is four disabled stub
 * tiles matching `ToolsDock`'s already-established
 * structure-ships-ahead-of-the-feature pattern (Rules/Search/Campaign/
 * World — none of the four have a real destination yet, same as
 * `ToolsDock`'s own Maps/Rules stubs on desktop).
 *
 * BOB_queue task 1: owns its own `JournalFilterBar` state, independent
 * of the desktop panel's copy in JournalScreen — the actual requirement
 * ("filter state survives switching tabs on mobile") falls out of this
 * component never unmounting when `activeView` changes; only its
 * children conditionally render, so a plain `useState` here already
 * persists across a Party -> Journal -> Quests round trip.
 */
export function MobileJournalView({
  loading,
  activeCharacter,
  characters,
  quests,
  sessions,
  items,
  sessionOpen,
  onLog,
  gmEnabled,
  onAskGm,
  onAskRules,
  campaignId,
  onOpenRules,
  onOpenCharacter,
  onOpenDice,
}: MobileJournalViewProps) {
  const [activeView, setActiveView] = useState<MobileView | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(() => new Set(ALL_FILTER_KINDS))

  function handleSelect(view: MobileView) {
    // Tap the already-open tab again -> home, per the mobile-vision
    // entry ("tapping the active tab again returns to the journal").
    setActiveView((current) => (current === view ? null : view))
  }

  function toggleFilter(kind: FilterKind) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const feedFilter = useMemo(
    () => (item: FeedItem) => item.kind === 'system' || activeFilters.has(item.kind as FilterKind),
    [activeFilters],
  )

  const showSelfCard = activeView === null && activeCharacter !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showSelfCard && activeCharacter && (
        <PlayerCard
          character={activeCharacter}
          variant="compact"
          onClick={() => onOpenCharacter(activeCharacter)}
          className="mx-4 mt-3 shrink-0"
        />
      )}

      {activeView !== null && (
        // 48px, not ColumnHeader's 38px: this row carries a real 44px
        // touch target, which a 38px row can't hold without breaking
        // CLAUDE.md's touch-target minimum.
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line-soft px-4">
          <span className={text.label}>{VIEW_TITLES[activeView]}</span>
          <button
            type="button"
            onClick={() => setActiveView(null)}
            aria-label="Back to the journal"
            title="Back to the journal"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-button text-ink-faint hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* BOB_queue task 1: pinned above the scrolling feed (like the
        * self-card above), not inside it — unlike the desktop panel,
        * which has no equivalent pinned slot and lets the bar scroll
        * away with the body. Home view only; it's journal-specific
        * chrome, not something that belongs on Party/Quests/Tools/Maps. */}
      {activeView === null && !loading && (
        <JournalFilterBar
          active={activeFilters}
          onToggle={toggleFilter}
          showRules={gmEnabled}
          className="shrink-0 px-4 pt-3 pb-2"
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonGroup label="Loading journal" className="gap-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SkeletonGroup>
        ) : activeView === null ? (
          <div className="px-4 py-3">
            <JournalFeed items={items} sessions={sessions} filter={feedFilter} />
          </div>
        ) : activeView === 'party' ? (
          <div className="flex flex-col gap-2 p-4">
            {characters.length > 0 ? (
              characters.map((character) => (
                <PlayerCard key={character.id} character={character} onClick={() => onOpenCharacter(character)} />
              ))
            ) : (
              <EmptyState icon="party" title="No party yet" description="Characters you add to this campaign show up here." />
            )}
          </div>
        ) : activeView === 'quests' ? (
          <div className="p-4">
            {quests.length > 0 ? (
              <QuestLogPanel quests={quests} />
            ) : (
              <EmptyState icon="quest" title="No quests yet" description="Quests logged for this campaign show up here." />
            )}
          </div>
        ) : activeView === 'tools' ? (
          <div className={cx('grid grid-cols-2 gap-3 p-4', text.label)}>
            {TOOL_TILES.map((tile) => (
              <ToolTile
                key={tile.label}
                {...tile}
                onClick={tile.label === 'Rules' ? onOpenRules : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon="map"
              title="Maps"
              description="Region, Site, and Scene maps are a later slice — nothing to show yet."
            />
          </div>
        )}
      </div>

      {activeView === null && (
        <div className="shrink-0 border-t border-line-soft bg-panel px-4 py-3">
          <JournalComposer
            onLog={onLog}
            sessionOpen={sessionOpen}
            gmEnabled={gmEnabled}
            onAskGm={onAskGm}
            onAskRules={onAskRules}
            campaignId={campaignId}
          />
        </div>
      )}

      <MobileTabBar active={activeView} onSelect={handleSelect} onOpenDice={onOpenDice} diceDisabled={!sessionOpen} />
    </div>
  )
}
