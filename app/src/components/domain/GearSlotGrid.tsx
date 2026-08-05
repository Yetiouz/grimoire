import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface GearSlotGridProps {
  /** Freeform equipment lines from `characters.sheet.equipment`. These
   * are NOT one-item-per-slot — a single array entry like "Crawling
   * kit: backpack, flint and steel, 2 torches, 3 rations, 10 iron
   * spikes, grappling hook, 60 feet of rope." bundles many physical
   * items into one descriptive line. `player-view-mockup.html`'s
   * `.slots` grid numbers each slot precisely ("1–2 Chainmail", "Slot
   * 10 — free"); that precision doesn't exist in the imported data, so
   * this renders the same chip grid unnumbered rather than fabricating
   * slot assignments the source sheets never specified. */
  items: string[]
  className?: string
}

/** The mockup's `.slots` chip grid, minus the numbering it can't
 * honestly claim. Caller (`CharacterSheet`) renders the real
 * `gear_current`/`gear_max` count as its own section label above this. */
export function GearSlotGrid({ items, className }: GearSlotGridProps) {
  return (
    <div className={cx('grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cx('rounded-[9px] border border-line-soft bg-panel2 px-3 py-2', text.bodySecondary)}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
