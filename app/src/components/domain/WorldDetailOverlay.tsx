import { Overlay } from '../ui/Overlay'
import { text } from '../../lib/typography'
import { QuestCard } from './QuestCard'
import { NpcCard } from './NpcCard'
import { FactionCard } from './FactionCard'
import { TreasureRow } from './TreasureRow'
import type { Quest } from '../../lib/quests'
import type { Faction, Npc, NpcStatBlock, Treasure } from '../../lib/world'

/** What `WorldPreviewRow`'s `onClick` in `WorldTabs` sets — one resolved
 * entity plus which of the four detail shapes it needs, rather than
 * threading four separate `openX`/`closeX` states through `WorldTabs`
 * the way `JournalScreen` threads one state per overlay (Maps/Rules/
 * Dice/CharacterSheet) — those are four genuinely different, independently
 * openable surfaces; these four are one surface (a Quest Log detail) that
 * happens to render four different card shapes depending on what was
 * clicked. `statBlock` only applies to `npc` — same optional-and-often-
 * absent shape `NpcCard` itself already takes. */
export type WorldSelection =
  | { kind: 'quest'; item: Quest }
  | { kind: 'npc'; item: Npc; statBlock?: NpcStatBlock }
  | { kind: 'faction'; item: Faction }
  | { kind: 'treasure'; item: Treasure }

const KIND_LABEL: Record<WorldSelection['kind'], string> = {
  quest: 'Quest',
  npc: 'NPC',
  faction: 'Faction',
  treasure: 'Treasure',
}

function renderSelection(selection: WorldSelection) {
  switch (selection.kind) {
    case 'quest':
      return <QuestCard quest={selection.item} />
    case 'npc':
      return <NpcCard npc={selection.item} statBlock={selection.statBlock} />
    case 'faction':
      return <FactionCard faction={selection.item} />
    case 'treasure':
      return <TreasureRow treasure={selection.item} />
  }
}

interface WorldDetailOverlayProps {
  selection: WorldSelection | null
  onClose: () => void
}

/**
 * The "pop up a screen with all the info" half of the preview/detail
 * split (2026-08-10, owner's call). Wraps the existing full-detail card
 * components (`QuestCard`/`NpcCard`/`FactionCard`/`TreasureRow` — these
 * used to BE the list, before `WorldPreviewRow` took that job over) in
 * `Overlay`, the same dialog primitive Maps/RulesChat/DiceRoller already
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
export function WorldDetailOverlay({ selection, onClose }: WorldDetailOverlayProps) {
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
