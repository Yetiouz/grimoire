import { Overlay } from '../ui/Overlay'
import { text } from '../../lib/typography'
import { QuestCard } from './QuestCard'
import { NpcCard } from './NpcCard'
import { FactionCard } from './FactionCard'
import { TreasureRow } from './TreasureRow'
import { NoteCard } from './NoteCard'
import { LocationCard } from './LocationCard'
import { ClockCard } from './ClockCard'
import type { Quest } from '../../lib/quests'
import type { Faction, Note, Npc, NpcStatBlock, Treasure, Location, LocationSecret, Clock } from '../../lib/world'

/** What `WorldPreviewRow`'s `onClick` in `WorldTabs` sets — one resolved
 * entity plus which of the five detail shapes it needs (`note` added
 * 2026-08-10 alongside `WorldTabs`' 5th tab), rather than threading five
 * separate `openX`/`closeX` states through `WorldTabs` the way
 * `JournalScreen` threads one state per overlay (Maps/Rules/Dice/
 * CharacterSheet) — those are genuinely different, independently
 * openable surfaces; these five are one surface (a Quest Log detail)
 * that happens to render a different card shape depending on what was
 * clicked. `statBlock` only applies to `npc` — same optional-and-often-
 * absent shape `NpcCard` itself already takes. */
export type WorldSelection =
  | { kind: 'quest'; item: Quest }
  | { kind: 'npc'; item: Npc; statBlock?: NpcStatBlock }
  | { kind: 'faction'; item: Faction }
  | { kind: 'treasure'; item: Treasure }
  | { kind: 'note'; item: Note }
  | { kind: 'location'; item: Location; secret?: LocationSecret }
  | { kind: 'clock'; item: Clock }

const KIND_LABEL: Record<WorldSelection['kind'], string> = {
  quest: 'Quest',
  npc: 'NPC',
  faction: 'Faction',
  treasure: 'Treasure',
  note: 'Note',
  location: 'Place',
  clock: 'Clock',
}

interface WorldDetailOverlayProps {
  selection: WorldSelection | null
  onClose: () => void
  /** Clock-only extras (BUILD_PLAN.md item 15 slice 2) -- the other five
   * card types are pure display, so `ClockCard` is the only one that
   * needs any of these. All four are `WorldTabs`' own
   * `factions`/`isOwner`/`useClockMutations` handlers, threaded straight
   * through unchanged -- this component doesn't own or transform them,
   * it just closes the selected clock's id over each handler so
   * `ClockCard` gets the plain `(delta) => Promise<void>`-shaped
   * callbacks it actually expects. */
  factions: Faction[]
  isOwner: boolean
  onAdjustClock: (clockId: string, delta: number) => Promise<void>
  onUpdateClock: (
    clockId: string,
    fields: { name: string; description: string; segments: number; factionId: string | null; revealed: boolean },
  ) => Promise<void>
  onDeleteClock: (clockId: string) => Promise<void>
}

/**
 * The "pop up a screen with all the info" half of the preview/detail
 * split (2026-08-10, owner's call). Wraps the existing full-detail card
 * components (`QuestCard`/`NpcCard`/`FactionCard`/`TreasureRow`/
 * `NoteCard` — the first four used to BE the list, before
 * `WorldPreviewRow` took that job over; `NoteCard` never had a
 * non-preview form) in `Overlay`, the same dialog primitive
 * Maps/RulesChat/DiceRoller already
 * use. `width="narrow"` (460px, `Overlay`'s existing narrow tier, built
 * for DiceRoller): a single detail card doesn't need the 880px default,
 * let alone Maps' 1200px `wide`.
 *
 * Header is just the entity KIND ("NPC", "Faction", …), not its name —
 * the card itself already leads with the name in its own header row, so
 * repeating it in `Overlay`'s header would be redundant; the kind label
 * is the one piece of information the card doesn't already carry on its
 * own (nothing about `NpcCard`'s rendered output says "this is an NPC"
 * rather than some other card type).
 */
export function WorldDetailOverlay({
  selection,
  onClose,
  factions,
  isOwner,
  onAdjustClock,
  onUpdateClock,
  onDeleteClock,
}: WorldDetailOverlayProps) {
  // Inline rather than a top-level function (like every other card's
  // render branch was before this slice): only the `clock` case needs
  // anything beyond `selection` itself, and closing over this
  // component's own props is simpler than threading five more
  // parameters through a standalone function on every call.
  function renderSelection(current: WorldSelection) {
    switch (current.kind) {
      case 'quest':
        return <QuestCard quest={current.item} />
      case 'npc':
        return <NpcCard npc={current.item} statBlock={current.statBlock} />
      case 'faction':
        return <FactionCard faction={current.item} />
      case 'treasure':
        return <TreasureRow treasure={current.item} />
      case 'note':
        return <NoteCard note={current.item} />
      case 'location':
        return <LocationCard location={current.item} secret={current.secret} />
      case 'clock':
        return (
          <ClockCard
            clock={current.item}
            factionName={factions.find((faction) => faction.id === current.item.faction_id)?.name ?? null}
            factions={factions}
            isOwner={isOwner}
            onAdjust={(delta) => onAdjustClock(current.item.id, delta)}
            onUpdateFields={(fields) => onUpdateClock(current.item.id, fields)}
            onDelete={() => onDeleteClock(current.item.id)}
          />
        )
    }
  }

  return (
    <Overlay
      open={selection !== null}
      onClose={onClose}
      header={<h2 className={text.h2}>{selection ? KIND_LABEL[selection.kind] : ''}</h2>}
      width="narrow"
    >
      {selection && renderSelection(selection)}
    </Overlay>
  )
}
