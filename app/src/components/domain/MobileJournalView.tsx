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
import { WorldTabs } from './WorldTabs'
import { MapsPanel } from './MapsPanel'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { GmTurnResult } from '../../lib/gm'
import type { FeedItem } from '../../lib/feed'
import type { GmCheck, ResolveSource } from '../../lib/checks'
import type { CampaignSession } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'
import type { Faction, Note, Npc, NpcStatBlock, Treasure } from '../../lib/world'

interface MobileJournalViewProps {
  loading: boolean
  activeCharacter: Character | null
  characters: Character[]
  quests: Quest[]
  /** BUILD_PLAN.md slice 9 (`WorldTabs`) — same data `JournalDesktopLayout`
   * takes, threaded here for the Quests tab's now-tabbed content. */
  npcs: Npc[]
  factions: Faction[]
  treasure: Treasure[]
  /** `WorldTabs`' 5th tab (2026-08-10) — same threaded-straight-through
   * treatment as `npcs`/`factions`/`treasure`. */
  notes: Note[]
  npcStatBlocks: Map<string, NpcStatBlock>
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
   * GM is off (which is the default). Slice 17: the caller now passes
   * its own `gm_mode`-gated value here (`aiGmActive` in `JournalScreen`)
   * — this component doesn't know or care about that distinction. */
  gmEnabled?: boolean
  onAskGm?: (input: string) => Promise<GmTurnResult>
  /** AI-voice on/off pill (2026-08-10) — forwarded straight to
   * `JournalFeed`, see its own doc comment. Both omitted together when
   * the voice tier doesn't exist in this build. */
  aiVoiceOn?: boolean
  onToggleAiVoice?: () => void
  /** BOB_queue task 1 fold-in: this was accepted as a prop already but
   * never declared here or threaded to JournalComposer below, so "Ask
   * Rules" was reachable on mobile but silently fell through to logging
   * the raw question as a journal entry instead. Fixed alongside the
   * rest of this task since both files were already open for it. */
  onAskRules?: (input: string) => Promise<GmTurnResult>
  /** Slice 17: forwarded straight to `JournalFeed` — see its own doc
   * comment. Both optional, same "omit for read-only" convention every
   * other feed callback here already follows. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  resolvingCheckId?: string | null
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

/** `world` dropped from this grid (2026-08-10, BUILD_PLAN.md slice 9 v2):
 * it was a disabled stub pointing at a destination that didn't exist yet
 * (the earlier separate-overlay plan for NPCs/Factions/Treasure). That
 * destination now lives under the Quests tab's own tab row instead (see
 * `WorldTabs`), so a second disabled tile pointing nowhere here would
 * just be confusing — per the owner's call when this redirect happened. */
const TOOL_TILES: Array<{ icon: IconName; label: string }> = [
  { icon: 'rules', label: 'Rules' },
  { icon: 'search', label: 'Search' },
  { icon: 'settings', label: 'Campaign' },
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
 * (`PlayerCard`, `QuestLogPanel`, `JournalFeed`/`JournalComposer`,
 * `MapsPanel`) — this file is the tab-driven switch between them plus
 * the one view that still doesn't exist (Tools), rendered honestly
 * rather than with fabricated data: Tools is four disabled stub tiles
 * matching `ToolsDock`'s already-established structure-ships-ahead-of-
 * the-feature pattern (Rules/Search/Campaign/World — none of the four
 * have a real destination yet, same as `ToolsDock`'s own Rules stub on
 * desktop).
 *
 * Maps (slice 8) renders `MapsPanel` directly, not wrapped in `Overlay`
 * the way `DiceRoller`/`CharacterSheet`/`RulesChat` are on both mobile
 * and desktop — unlike those three, Maps already has its own permanent
 * bottom-tab destination here (unlike ToolsDock's stub-button entry
 * point on desktop, which has no equivalent persistent slot), and the
 * header-row above already gives every mobile tab a title + close-to-
 * journal control. A second nested `Overlay` here would just wrap one
 * closeable panel inside another that's already closeable the same way.
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
  npcs,
  factions,
  treasure,
  notes,
  npcStatBlocks,
  sessions,
  items,
  sessionOpen,
  onLog,
  gmEnabled,
  onAskGm,
  onAskRules,
  aiVoiceOn,
  onToggleAiVoice,
  onResolveCheck,
  resolvingCheckId,
  campaignId,
  onOpenRules,
  onOpenCharacter,
  onOpenDice,
}: MobileJournalViewProps) {
  const [activeView, setActiveView] = useState<MobileView | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(() => new Set(ALL_FILTER_KINDS))
  // "Save as note" quick action (2026-08-09): this view's own copy of
  // the seed state, independent of JournalDesktopLayout's — same
  // always-mounted-siblings reasoning as that component's copy.
  const [noteSeed, setNoteSeed] = useState<{ body: string } | null>(null)

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

  // Slice 17: 'check' bypasses the filter same as 'system' — a check
  // card has no chip of its own to mute it by (ALL_FILTER_KINDS never
  // included it, same reasoning journalFilters.ts already documents for
  // 'system').
  const feedFilter = useMemo(
    () => (item: FeedItem) => item.kind === 'system' || item.kind === 'check' || activeFilters.has(item.kind as FilterKind),
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

      {/* Quests is pulled out of the shared scrolling wrapper below
        * (2026-08-10, BUILD_PLAN.md slice 9 v2): `WorldTabs` pins its own
        * tab row above its own internally-scrolling list — nesting that
        * inside a second `overflow-y-auto` ancestor would leave the tab
        * row with nothing bounding its height to pin against (a scrolling
        * block, unlike a sized flex container, doesn't constrain a
        * `flex-1` child), so the tab row would just scroll away with the
        * body exactly like the old unbtabbed panel did. Giving it its own
        * sibling slot here — a direct flex child of this component's own
        * `flex flex-col` root — gives it the bounded height it needs. */}
      {!loading && activeView === 'quests' ? (
        <WorldTabs
          quests={quests}
          npcs={npcs}
          factions={factions}
          treasure={treasure}
          notes={notes}
          npcStatBlocks={npcStatBlocks}
          justifyTabs
          className="min-h-0 flex-1 px-4 pb-4 pt-3"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonGroup label="Loading journal" className="gap-3 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </SkeletonGroup>
          ) : activeView === null ? (
            <div className="px-4 py-3">
              <JournalFeed
                items={items}
                sessions={sessions}
                filter={feedFilter}
                onSaveAsNote={sessionOpen ? (item) => setNoteSeed({ body: item.body }) : undefined}
                aiVoiceOn={aiVoiceOn}
                onToggleAiVoice={onToggleAiVoice}
                onResolveCheck={onResolveCheck}
                resolvingCheckId={resolvingCheckId}
              />
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
          ) : campaignId ? (
            <div className="p-4">
              <MapsPanel campaignId={campaignId} />
            </div>
          ) : (
            <div className="p-4">
              <EmptyState icon="map" title="Maps" description="Open a campaign to see its maps." />
            </div>
          )}
        </div>
      )}

      {activeView === null && (
        <div className="shrink-0 border-t border-line-soft bg-panel px-4 py-3">
          <JournalComposer
            onLog={onLog}
            sessionOpen={sessionOpen}
            gmEnabled={gmEnabled}
            onAskGm={onAskGm}
            onAskRules={onAskRules}
            campaignId={campaignId}
            seed={noteSeed}
          />
        </div>
      )}

      <MobileTabBar active={activeView} onSelect={handleSelect} onOpenDice={onOpenDice} diceDisabled={!sessionOpen} />
    </div>
  )
}
