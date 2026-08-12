import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { deriveStatusIndicator, isQuestClosed } from '../../lib/statusTone'
import { WorldPreviewRow } from './WorldPreviewRow'
import { WorldDetailOverlay } from './WorldDetailOverlay'
import type { WorldSelection } from './WorldDetailOverlay'
import type { Quest } from '../../lib/quests'
import type { Npc, Faction, Treasure, Note, NpcStatBlock, Location, LocationSecret } from '../../lib/world'

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
  /** BUILD_PLAN.md item 15 slice 1 (2026-08-12): the 6th tab, backed by
   * migration `0024_locations` — replaces `world.md`'s Settlements/
   * Regions/Adventure Sites list. */
  locations: Location[]
  /** Keyed by `npc_id` — build with
   * `new Map(statBlockRows.map(row => [row.npc_id, row]))` from
   * `listNpcStatBlocks`. Empty for a non-owner viewer (RLS-filtered), so
   * every NPC's detail view naturally opens with no GM section — see
   * that map's own doc comment for why no separate `isGm` flag is
   * threaded through here. */
  npcStatBlocks: Map<string, NpcStatBlock>
  /** Same shape as `npcStatBlocks`, keyed by `location_id` — see
   * `listLocationSecrets`' own doc comment. */
  locationSecrets: Map<string, LocationSecret>
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

type WorldTab = 'quests' | 'npcs' | 'factions' | 'treasure' | 'notes' | 'locations'

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
  { key: 'locations', label: 'Places' },
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
 *
 * v5 (2026-08-10, owner: "the quests button is more a logs button" —
 * every quest sat in one flat list in original import order regardless
 * of whether it was still open, which reads as a history of what
 * happened rather than a board of what's left to do). The Quests tab
 * only, below, now splits into an Open group (unchanged row shape) and
 * a Resolved group (title + dot only, `preview` withheld — see
 * `isQuestClosed`'s own doc comment for why this needed a narrower
 * check than the existing status tone). No new field and no re-import:
 * both groups read the same `quest.status` string `deriveStatusIndicator`
 * already parses for the dot.
 */
export function WorldTabs({ quests, npcs, factions, treasure, notes, locations, npcStatBlocks, locationSecrets, justifyTabs, className }: WorldTabsProps) {
  const [activeTab, setActiveTab] = useState<WorldTab>('quests')
  const [selection, setSelection] = useState<WorldSelection | null>(null)

  // v5's Open/Resolved split (see the component doc comment above) —
  // computed here rather than inline in the JSX below purely for
  // readability; `quests` is a handful of rows (7 in the real imported
  // data as of this pass), so partitioning on every render costs
  // nothing worth memoizing.
  const openQuests = quests.filter((quest) => !isQuestClosed(quest.status))
  const resolvedQuests = quests.filter((quest) => isQuestClosed(quest.status))

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
            <>
              {openQuests.map((quest) => (
                <WorldPreviewRow
                  key={quest.id}
                  title={quest.title}
                  indicator={deriveStatusIndicator(quest.status)}
                  preview={quest.goal}
                  onClick={() => setSelection({ kind: 'quest', item: quest })}
                />
              ))}

              {resolvedQuests.length > 0 && (
                <>
                  {/* Plain label, not a `SceneDivider` — that component's
                    * centered rule-flanked treatment is built for the
                    * journal's scrolling scene breaks; this is a compact
                    * list-section header, closer in spirit to a filter
                    * chip row's own left-aligned caption. Count uses the
                    * same neutral pill shape as everywhere else a bare
                    * number needs a background (no tone here — this
                    * isn't a status, just a count). */}
                  <div className={cx(text.label, 'mt-2 flex items-center gap-2 uppercase tracking-eyebrow text-ink-faint')}>
                    Resolved
                    <span className="rounded-full bg-line-soft px-2 py-0.5 text-ink-dim">{resolvedQuests.length}</span>
                  </div>
                  {resolvedQuests.map((quest) => (
                    <WorldPreviewRow
                      key={quest.id}
                      title={quest.title}
                      indicator={deriveStatusIndicator(quest.status)}
                      // Withheld on purpose (v5): a resolved quest's goal
                      // line already happened — the title plus the dot's
                      // label ("Resolved", "Complete", ...) says enough,
                      // and dropping the second line is what keeps this
                      // group visually out of the way instead of taking
                      // the same room as what's still open.
                      preview={null}
                      onClick={() => setSelection({ kind: 'quest', item: quest })}
                    />
                  ))}
                </>
              )}
            </>
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

        {activeTab === 'locations' &&
          (locations.length > 0 ? (
            locations.map((location) => (
              <WorldPreviewRow
                key={location.id}
                title={location.name}
                indicator={deriveStatusIndicator(location.status)}
                preview={location.summary || null}
                onClick={() => setSelection({ kind: 'location', item: location, secret: locationSecrets.get(location.id) })}
              />
            ))
          ) : (
            <EmptyState icon="map" title="No places yet" description="Locations logged for this campaign show up here." />
          ))}
      </div>

      <WorldDetailOverlay selection={selection} onClose={() => setSelection(null)} />
    </div>
  )
}
