import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { WorldPreviewRow } from './WorldPreviewRow'
import { WorldDetailOverlay } from './WorldDetailOverlay'
import type { WorldSelection } from './WorldDetailOverlay'
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
   * every NPC's detail view naturally opens with no GM section — see
   * that map's own doc comment for why no separate `isGm` flag is
   * threaded through here. */
  npcStatBlocks: Map<string, NpcStatBlock>
  className?: string
}

type WorldTab = 'quests' | 'npcs' | 'factions' | 'treasure'

/** Mockup-approved labels (`quest-log-tabs-fit-options-mockup.html`,
 * variant C — the owner's pick): short words, no icons, chosen because
 * the four full words ("Quests"/"NPCs"/"Factions"/"Treasure") don't
 * reliably fit the desktop Quest Log column's real width in one row
 * without a horizontal scroll. */
const TABS: Array<{ key: WorldTab; label: string }> = [
  { key: 'quests', label: 'Quests' },
  { key: 'npcs', label: 'People' },
  { key: 'factions', label: 'Factions' },
  { key: 'treasure', label: 'Loot' },
]

/**
 * BUILD_PLAN.md slice 9, v3 (2026-08-10): two owner redirects layered on
 * top of each other. v2 moved NPCs/Factions/Treasure from a separate
 * ToolsDock overlay into tabs on the existing Quest Log panel (see this
 * file's earlier doc comment, still true below for why the tab row and
 * scrolling list are one self-contained flex column rather than split
 * across `ColumnCard`'s slots). v3 is this pass: every tab now renders
 * compact `WorldPreviewRow`s (title + unified status dot + one line of
 * context) instead of the full detail cards directly — clicking a row
 * opens `WorldDetailOverlay` with the complete card
 * (`QuestCard`/`NpcCard`/`FactionCard`/`TreasureRow`), per the owner's
 * "previews... then when you click on it, pop up a screen with all the
 * info." `selection` here is the one piece of new state this needed;
 * `activeTab` is unchanged from v2.
 */
export function WorldTabs({ quests, npcs, factions, treasure, npcStatBlocks, className }: WorldTabsProps) {
  const [activeTab, setActiveTab] = useState<WorldTab>('quests')
  const [selection, setSelection] = useState<WorldSelection | null>(null)

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
            quests.map((quest) => (
              <WorldPreviewRow
                key={quest.id}
                title={quest.title}
                indicator={deriveStatusIndicator(quest.status)}
                preview={quest.goal}
                onClick={() => setSelection({ kind: 'quest', item: quest })}
              />
            ))
          ) : (
            <EmptyState icon="quest" title="No quests yet" description="Quests logged for this campaign show up here." />
          ))}

        {activeTab === 'npcs' &&
          (npcs.length > 0 ? (
            npcs.map((npc) => (
              <WorldPreviewRow
                key={npc.id}
                title={npc.name}
                indicator={deriveStatusIndicator(npc.status)}
                preview={npc.role}
                onClick={() => setSelection({ kind: 'npc', item: npc, statBlock: npcStatBlocks.get(npc.id) })}
              />
            ))
          ) : (
            <EmptyState icon="party" title="No NPCs yet" description="NPCs logged for this campaign show up here." />
          ))}

        {activeTab === 'factions' &&
          (factions.length > 0 ? (
            factions.map((faction) => (
              <WorldPreviewRow
                key={faction.id}
                title={faction.name}
                indicator={deriveStatusIndicator(faction.disposition)}
                preview={faction.type}
                onClick={() => setSelection({ kind: 'faction', item: faction })}
              />
            ))
          ) : (
            <EmptyState icon="world" title="No factions yet" description="Factions logged for this campaign show up here." />
          ))}

        {activeTab === 'treasure' &&
          (treasure.length > 0 ? (
            treasure.map((item) => (
              <WorldPreviewRow
                key={item.id}
                title={item.name}
                indicator={deriveStatusIndicator(item.status)}
                preview={[item.category, item.quantity_value].filter(Boolean).join(' · ') || null}
                onClick={() => setSelection({ kind: 'treasure', item })}
              />
            ))
          ) : (
            <EmptyState icon="gear" title="No treasure yet" description="Treasure logged for this campaign shows up here." />
          ))}
      </div>

      <WorldDetailOverlay selection={selection} onClose={() => setSelection(null)} />
    </div>
  )
}
