import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { MobileTabBar } from '../ui/MobileTabBar'
import type { MobileView } from '../ui/MobileTabBar'
import { JournalFeed } from './JournalFeed'
import { JournalComposer } from './JournalComposer'
import { PlayerCard } from './PlayerCard'
import { QuestLogPanel } from './QuestLogPanel'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { CampaignSession, JournalEntry } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'

interface MobileJournalViewProps {
  loading: boolean
  activeCharacter: Character | null
  characters: Character[]
  quests: Quest[]
  sessions: CampaignSession[]
  entries: JournalEntry[]
  sessionOpen: boolean
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  onOpenCharacter: (character: Character) => void
  onOpenDice: () => void
}

const TOOL_TILES: Array<{ icon: IconName; label: string }> = [
  { icon: 'rules', label: 'Rules' },
  { icon: 'search', label: 'Search' },
  { icon: 'settings', label: 'Campaign' },
  { icon: 'world', label: 'World' },
]

function ToolTile({ icon, label }: { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      disabled
      title={`${label} (coming soon)`}
      aria-label={`${label} (coming soon)`}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-card border border-line bg-panel text-ink-dim opacity-50"
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
 */
export function MobileJournalView({
  loading,
  activeCharacter,
  characters,
  quests,
  sessions,
  entries,
  sessionOpen,
  onLog,
  onOpenCharacter,
  onOpenDice,
}: MobileJournalViewProps) {
  const [activeView, setActiveView] = useState<MobileView | null>(null)

  function handleSelect(view: MobileView) {
    // Tap the already-open tab again -> home, per the mobile-vision
    // entry ("tapping the active tab again returns to the journal").
    setActiveView((current) => (current === view ? null : view))
  }

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonGroup label="Loading journal" className="gap-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SkeletonGroup>
        ) : activeView === null ? (
          <div className="px-4 py-3">
            <JournalFeed entries={entries} sessions={sessions} />
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
              <ToolTile key={tile.label} {...tile} />
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
          <JournalComposer onLog={onLog} sessionOpen={sessionOpen} />
        </div>
      )}

      <MobileTabBar active={activeView} onSelect={handleSelect} onOpenDice={onOpenDice} diceDisabled={!sessionOpen} />
    </div>
  )
}
