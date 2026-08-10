import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { WorldPreviewRow } from './WorldPreviewRow'
import { WorldDetailOverlay } from './WorldDetailOverlay'
import type { WorldSelection } from './WorldDetailOverlay'
import type { Quest } from '../../lib/quests'
import type { Npc, Faction, Treasure, Note, NpcStatBlock } from '../../lib/world'

interface WorldTabsProps {
  quests: Quest[]
  npcs: Npc[]
  factions: Faction[]
  treasure: Treasure[]
  /** `WorldTabs`' 5th tab (2026-08-10, owner's call: "I would consider...
   * adding notes" — a freeform campaign scratchpad, not a field on any
   * one of the other four entity types). Newest-first (see
   * `listCampaignNotes`'s own doc comment for why that's the one list
   * here that isn't creation-order). */
  notes: Note[]
  /** Keyed by `npc_id` — build with
   * `new Map(statBlockRows.map(row => [row.npc_id, row]))` from
   * `listNpcStatBlocks`. Empty for a non-owner viewer (RLS-filtered), so
   * every NPC's detail view naturally opens with no GM section — see
   * that map's own doc comment for why no separate `isGm` flag is
   * threaded through here. */
  npcStatBlocks: Map<string, NpcStatBlock>
  /** Mobile's request (2026-08-10, owner: "expand the buttons... so the
   * tabs are justified but keep the same space between them") — mobile's
   * wider tab row otherwise left visible slack after 5 short labels the
   * way desktop's tight 26rem column never does. `false` (the default,
   * desktop's call site) keeps every tab its natural content width,
   * left-aligned, same as before. `true` (mobile's call site) makes each
   * tab `flex-1` instead of `shrink-0` — the row's existing `gap-1.5`
   * between them is untouched either way, so "justified" comes purely
   * from the buttons themselves growing to fill the row, not from
   * `justify-between`-style extra gap. */
  justifyTabs?: boolean
  className?: string
}

type WorldTab = 'quests' | 'npcs' | 'factions' | 'treasure' | 'notes'

/** Mockup-approved labels (`quest-log-tabs-fit-options-mockup.html`,
 * variant C — the owner's pick): short words, no icons, chosen because
 * the four full words ("Quests"/"NPCs"/"Factions"/"Treasure") don't
 * reliably fit the desktop Quest Log column's real width in one row
 * without a horizontal scroll. "People" -> "NPCs" (2026-08-10, owner's
 * follow-up call) — still short enough to fit alongside the other three
 * plus the new 5th "Notes" tab; the tab row already scrolls horizontally
 * (`overflow-x-auto`) if a narrower viewport ever can't fit all five. */
const TABS: Array<{ key: WorldTab; label: string }> = [
  { key: 'quests', label: 'Quests' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'factions', label: 'Factions' },
  { key: 'treasure', label: 'Loot' },
  { key: 'notes', label: 'Notes' },
]

/**
 * BUILD_PLAN.md slice 9, v4 (2026-08-10): three owner redirects layered
 * on top of each other. v2 moved NPCs/Factions/Treasure from a separate
 * ToolsDock overlay into tabs on the existing Quest Log panel (see this
 * file's earlier doc comment, still true below for why the tab row and
 * scrolling list are one self-contained flex column rather than split
 * across `ColumnCard`'s slots). v3 made every tab render compact
 * `WorldPreviewRow`s (title + unified status dot + one line of context)
 * instead of the full detail cards directly — clicking a row opens
 * `WorldDetailOverlay` with the complete card
 * (`QuestCard`/`NpcCard`/`FactionCard`/`TreasureRow`), per the owner's
 * "previews... then when you click on it, pop up a screen with all the
 * info." v4 is this pass: "People" -> "NPCs" (the label, not the `npcs`
 * tab key — nothing downstream changed), plus a 5th "Notes" tab backed
 * by the new `campaign_notes` table (`lib/world.ts`'s
 * `listCampaignNotes`) for freeform campaign notes that aren't tied to
 * any one NPC/faction/quest/treasure row. `selection`/`activeTab` are
 * otherwise unchanged from v3.
 */
export function WorldTabs({ quests, npcs, factions, treasure, notes, npcStatBlocks, justifyTabs, className }: WorldTabsProps) {
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
              justifyTabs ? 'flex-1 text-center' : 'shrink-0',
              'rounded-full border px-3 py-1.5 font-semibold uppercase tracking-eyebrow',
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

        {activeTab === 'notes' &&
          (notes.length > 0 ? (
            notes.map((note) => (
              <WorldPreviewRow
                key={note.id}
                title={note.title}
                indicator={null}
                preview={note.body || null}
                onClick={() => setSelection({ kind: 'note', item: note })}
              />
            ))
          ) : (
            <EmptyState icon="journal" title="No notes yet" description="Notes logged for this campaign show up here." />
          ))}
      </div>

      <WorldDetailOverlay selection={selection} onClose={() => setSelection(null)} />
    </div>
  )
}
