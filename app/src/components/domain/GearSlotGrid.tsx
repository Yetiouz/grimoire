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
  /** Slice 6 (character commands): when supplied, each chip grows a
   * small "Drop" affordance calling this with the item's real array
   * index — `remove_character_gear`'s own addressing scheme (see its
   * migration comment on why index rather than name-match). Omit to
   * keep the grid read-only, e.g. anywhere this list is shown without
   * the edit commands wired up. */
  onRemove?: (index: number) => void
  removeDisabled?: boolean
  className?: string
}

/** The mockup's `.slots` chip grid, minus the numbering it can't
 * honestly claim. Caller (`CharacterSheet`) renders the real
 * `gear_current`/`gear_max` count as its own section label above this. */
export function GearSlotGrid({ items, onRemove, removeDisabled, className }: GearSlotGridProps) {
  return (
    <div className={cx('grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]', className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cx(
            'flex items-center justify-between gap-2 rounded-[9px] border border-line-soft bg-panel2 px-3 py-2',
            text.bodySecondary,
          )}
        >
          <span className="min-w-0 break-words">{item}</span>
          {onRemove && (
            <button
              type="button"
              disabled={removeDisabled}
              onClick={() => onRemove(index)}
              aria-label={`Drop ${item}`}
              title="Drop this item"
              className={cx(text.label, 'shrink-0 text-ink-faint hover:text-red disabled:pointer-events-none disabled:opacity-40')}
            >
              Drop
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
