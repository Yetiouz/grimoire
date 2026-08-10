import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { QuestLogPanel } from './QuestLogPanel'
import { NpcCard } from './NpcCard'
import { FactionCard } from './FactionCard'
import { TreasureRow } from './TreasureRow'
import type { Quest } from '../../lib/quests'
import type { Npc, Faction, Treasure, NpcStatBlock } from '../../lib/world'

interface WorldTabsProps {
  quests: Quest[]
  npcs: Npc[]
  factions: Faction[]
  treasure: Treasure[]
  /** Keyed by `npc_id` — build with
   * `new Map(statBlockRows.map(row => [row.npc_id, row]))` from
   * `listNpcStatBlocks`. Empty for a non-owner viewer (RLS-filtered), so
   * every `NpcCard` below naturally renders with no GM section — see
   * that map's own doc comment for why no separate `isGm` flag is
   * threaded through here. */
  npcStatBlocks: Map<string, NpcStatBlock>
  className?: string
}

type WorldTab = 'quests' | 'npcs' | 'factions' | 'treasure'

/** Mockup-approved labels (`quest-log-tabs-fit-options-mockup.html`,
 * variant C — the owner's pick): short words, no icons, chosen because
 * the four full words ("Quests"/"NPCs"/"Factions"/"Treasure") don't
 * reliably fit the desktop Quest Log column's real 20rem width in one
 * row without a horizontal scroll, and the icon variants either added a
 * new icon this app's closed icon set doesn't have (Factions/Treasure)
 * or dropped legibility for a first-time player (icons-only). */
const TABS: Array<{ key: WorldTab; label: string }> = [
  { key: 'quests', label: 'Quests' },
  { key: 'npcs', label: 'People' },
  { key: 'factions', label: 'Factions' },
  { key: 'treasure', label: 'Loot' },
]

/**
 * BUILD_PLAN.md slice 9, v2 (2026-08-10 — the owner's redirect from a
 * separate ToolsDock button + modal overlay to tabs on the existing,
 * always-visible Quest Log panel): NPCs/Factions/Treasure sit alongside
 * Quests as four tabs in one panel, rather than a second click-to-open
 * surface. This component owns the tab row AND the scrolling list below
 * it as one self-contained flex column — deliberately not split across
 * `ColumnCard`'s `header`/`subheader`/`children` slots, because that
 * would need the tab-selection state to live in whichever parent
 * assembles those three props, and this exact same component needs to
 * drop into two different parents (`JournalDesktopLayout`'s `ColumnCard`
 * child, and `MobileJournalView`'s own bespoke layout, which doesn't use
 * `ColumnCard` at all) without either one knowing about tab state. Both
 * callers just give this a bounded height (`flex-1 min-h-0` from a flex
 * parent) and it handles pinning its own tab row above its own
 * internally-scrolling list — the same "pinned strip + scrolling body"
 * shape `ColumnCard` itself uses, just self-contained rather than
 * composed from outside.
 *
 * Reuses `QuestLogPanel` for the Quests tab rather than duplicating its
 * `.map(QuestCard)` — this component is additive to that one, not a
 * replacement for it.
 */
export function WorldTabs({ quests, npcs, factions, treasure, npcStatBlocks, className }: WorldTabsProps) {
  const [activeTab, setActiveTab] = useState<WorldTab>('quests')

  return (
    <div className={cx('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cx(
              text.caption,
              'shrink-0 rounded-full border px-3 py-1.5 font-semibold uppercase tracking-eyebrow',
              activeTab === tab.key ? 'border-purple bg-purple text-white' : 'border-line-soft bg-panel2 text-ink-dim',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {activeTab === 'quests' &&
          (quests.length > 0 ? (
            <QuestLogPanel quests={quests} />
          ) : (
            <EmptyState icon="quest" title="No quests yet" description="Quests logged for this campaign show up here." />
          ))}

        {activeTab === 'npcs' &&
          (npcs.length > 0 ? (
            npcs.map((npc) => <NpcCard key={npc.id} npc={npc} statBlock={npcStatBlocks.get(npc.id)} />)
          ) : (
            <EmptyState icon="party" title="No NPCs yet" description="NPCs logged for this campaign show up here." />
          ))}

        {activeTab === 'factions' &&
          (factions.length > 0 ? (
            factions.map((faction) => <FactionCard key={faction.id} faction={faction} />)
          ) : (
            <EmptyState icon="world" title="No factions yet" description="Factions logged for this campaign show up here." />
          ))}

        {activeTab === 'treasure' &&
          (treasure.length > 0 ? (
            treasure.map((item) => <TreasureRow key={item.id} treasure={item} />)
          ) : (
            <EmptyState icon="gear" title="No treasure yet" description="Treasure logged for this campaign shows up here." />
          ))}
      </div>
    </div>
  )
}
