import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { EmptyState } from '../ui/EmptyState'
import { deriveStatusIndicator, isQuestClosed } from '../../lib/statusTone'
import { WorldPreviewRow } from './WorldPreviewRow'
import { WorldDetailOverlay } from './WorldDetailOverlay'
import { ClockCreateForm } from './ClockCreateForm'
import { useClockMutations } from '../../hooks/useClockMutations'
import type { WorldSelection } from './WorldDetailOverlay'
import type { Quest } from '../../lib/quests'
import type { Npc, Faction, Treasure, Note, NpcStatBlock, Location, LocationSecret, Clock } from '../../lib/world'

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
  /** BUILD_PLAN.md item 15 slice 2 (2026-08-14): the 7th tab. Unlike
   * every list above, this one is mutated from inside this component
   * (`ClockCard`/`ClockCreateForm` call `lib/world.ts`'s owner-only
   * RPCs directly) rather than only ever read — see `reloadClocks`
   * below for how a mutation gets back into this prop. */
  clocks: Clock[]
  /** Gates every clock mutation control — same `campaign.owner ===
   * user.id` check `JournalScreen` already threads to
   * `CampaignInvite`/the mobile Tools tab's Invite tile, reused here
   * rather than re-derived. RLS enforces the real boundary regardless
   * (see migration `0025_clocks`); this just decides whether a
   * non-owner even sees the buttons. */
  isOwner: boolean
  /** Re-fetches `clocks` alone after a create/adjust/update/delete —
   * `useJournalScreenData`'s targeted reload, not the full `load()`.
   * Threaded down rather than called via a `campaignId` prop here so
   * this component doesn't need its own copy of "how to fetch clocks"
   * — it only ever asks the parent to refresh. */
  reloadClocks: () => Promise<void>
  /** `create_clock`'s first argument (see `handleCreateClock` below) —
   * both callers (`JournalDesktopLayout`/`MobileJournalView`) already
   * have a real campaign id in scope for other props, so this is just
   * one more straight pass-through, not new plumbing. */
  campaignId: string
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

type WorldTab = 'quests' | 'npcs' | 'factions' | 'treasure' | 'notes' | 'locations' | 'clocks'

/** Mockup-approved labels (`quest-log-tabs-fit-options-mockup.html`,
 * variant C — the owner's pick): short words, no icons, chosen because
 * the four full words ("Quests"/"NPCs"/"Factions"/"Treasure") don't
 * reliably fit the desktop Quest Log column's real width in one row
 * without a horizontal scroll. "People" -> "NPCs" (2026-08-10, owner's
 * follow-up call) — still short enough to fit alongside the other three
 * plus the 5th "Notes" tab.
 *
 * 2026-08-14 polish-audit fix: adding the 6th "Places" tab (slice 1 of
 * BUILD_PLAN item 15) pushed the row past the desktop column's width on
 * ordinary viewports, not just narrow ones — and the row's
 * `overflow-x-auto` fallback below hides its own scrollbar
 * (`scrollbarWidth: 'none'`), so the new tab just silently scrolled out
 * of view with no visual cue it existed (confirmed live: the DOM had a
 * working "Places" button the whole time, findable via the accessibility
 * tree, invisible on screen). Desktop's tab row (`justifyTabs` false)
 * now wraps to a 2nd line instead of scrolling — every tab stays
 * discoverable without a scroll gesture. Mobile's `justifyTabs` row
 * keeps the original scroll-with-hidden-scrollbar behavior: it's a
 * full-width `flex-1` segmented control by design (see `justifyTabs`'
 * own doc comment above), where wrapping would break the "justified"
 * look, and mobile's wider row has more room per tab than desktop's
 * tight 26rem column. */
const TABS: Array<{ key: WorldTab; label: string }> = [
  { key: 'quests', label: 'Quests' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'factions', label: 'Factions' },
  { key: 'treasure', label: 'Loot' },
  { key: 'notes', label: 'Notes' },
  { key: 'locations', label: 'Places' },
  { key: 'clocks', label: 'Clocks' },
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
export function WorldTabs({ quests, npcs, factions, treasure, notes, locations, npcStatBlocks, locationSecrets, clocks, isOwner, reloadClocks, campaignId, justifyTabs, className }: WorldTabsProps) {
  const [activeTab, setActiveTab] = useState<WorldTab>('quests')
  const [selection, setSelection] = useState<WorldSelection | null>(null)

  // v5's Open/Resolved split (see the component doc comment above) —
  // computed here rather than inline in the JSX below purely for
  // readability; `quests` is a handful of rows (7 in the real imported
  // data as of this pass), so partitioning on every render costs
  // nothing worth memoizing.
  const openQuests = quests.filter((quest) => !isQuestClosed(quest.status))
  const resolvedQuests = quests.filter((quest) => isQuestClosed(quest.status))

  // Keeps an open clock detail overlay showing live data after a
  // mutation, and closes it if the clock it's showing was just deleted
  // — `clocks` (a fresh array from `reloadClocks`) is the source of
  // truth; `selection.item` is a snapshot taken at click time that
  // would otherwise go stale the instant `ClockCard`'s Advance/Reduce/
  // Edit calls resolve. Only touches `selection` when it's actually
  // showing a clock; every other tab's cards are still read-only, so
  // their own selections never go stale this way.
  useEffect(() => {
    if (selection?.kind !== 'clock') return
    const fresh = clocks.find((clock) => clock.id === selection.item.id)
    setSelection(fresh ? { kind: 'clock', item: fresh } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clocks])

  const { handleAdjustClock, handleUpdateClock, handleDeleteClock, handleCreateClock } = useClockMutations(campaignId, reloadClocks)

  return (
    <div className={cx('flex min-h-0 flex-1 flex-col', className)}>
      <div
        className={cx(
          'flex shrink-0 gap-1.5 pb-2',
          justifyTabs ? 'overflow-x-auto' : 'flex-wrap',
        )}
        style={justifyTabs ? { scrollbarWidth: 'none' } : undefined}
      >
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

        {activeTab === 'clocks' && (
          <>
            {clocks.length > 0 ? (
              clocks.map((clock) => (
                <WorldPreviewRow
                  key={clock.id}
                  title={clock.name}
                  indicator={{ label: clock.revealed ? 'Revealed' : 'GM only', tone: clock.revealed ? 'positive' : 'special' }}
                  preview={`${clock.filled}/${clock.segments} segments filled`}
                  onClick={() => setSelection({ kind: 'clock', item: clock })}
                />
              ))
            ) : (
              <EmptyState icon="world" title="No clocks yet" description="Threat and faction clocks you track show up here." />
            )}
            {isOwner && <ClockCreateForm factions={factions} onCreate={handleCreateClock} />}
          </>
        )}
      </div>

      <WorldDetailOverlay
        selection={selection}
        onClose={() => setSelection(null)}
        factions={factions}
        isOwner={isOwner}
        onAdjustClock={handleAdjustClock}
        onUpdateClock={handleUpdateClock}
        onDeleteClock={handleDeleteClock}
      />
    </div>
  )
}
