import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { findEquipmentByName } from '../../lib/rules/equipment'
import { ItemBustIcon } from './AncestryClassArt'
import { Icon } from '../ui/Icon'

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
 * `gear_current`/`gear_max` count as its own section label above this.
 *
 * Icon badge added 2026-08-11 (reorganized Character Sheet mockup
 * review, "can I see slots with icons of what it is") — every chip
 * originally got the same closed-set `gear` glyph (Icon.tsx's
 * `Backpack`), not a per-item weapon/armor/tool icon, because `items`
 * are freeform text with no structured item-type field to key a
 * per-item icon off of.
 *
 * Overnight 2026-08-17, alongside the new `item-icons` art set landing
 * in the Gear step's Shop (`ItemBustIcon` in `AncestryClassArt.tsx`):
 * each chip now tries `findEquipmentByName` for an EXACT (not
 * substring) match against the Core catalog and shows that item's real
 * tinted icon when found — Shop pushes its catalog's own `name` string
 * verbatim on every purchase, so anything bought through Shop matches
 * here for free. A line that doesn't match (a freeform typed item, or
 * a 0-level gear-roll bundle like "Crawling kit: backpack, flint and
 * steel, ...") falls back to the same generic `gear` glyph as before —
 * this grid still won't guess which single icon a multi-item bundle
 * "is", for the same reason it won't fabricate slot numbers. */
export function GearSlotGrid({ items, onRemove, removeDisabled, className }: GearSlotGridProps) {
  return (
    <div className={cx('grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]', className)}>
      {items.map((item, index) => {
        const matched = findEquipmentByName(item)
        return (
          <div
            key={index}
            className={cx(
              'flex items-start gap-2.5 rounded-[9px] border border-line-soft bg-panel2 px-3 py-2',
              text.bodySecondary,
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-panel">
              {matched ? (
                <ItemBustIcon itemKey={matched.key} category={matched.category} className="h-4 w-4" />
              ) : (
                <Icon name="gear" className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1 break-words">{item}</span>
            {onRemove && (
              <button
                type="button"
                disabled={removeDisabled}
                onClick={() => onRemove(index)}
                aria-label={`Drop ${item}`}
                title="Drop this item"
                className={cx(
                  text.label,
                  'mt-0.5 shrink-0 text-ink-faint hover:text-red disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                Drop
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
