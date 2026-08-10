import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Treasure } from '../../lib/world'

interface TreasureRowProps {
  treasure: Treasure
  className?: string
}

/** `treasure.status` is real but small/enum-like today (held / pending
 * recovery / lead-only, unrecovered / contained / secured / on loan —
 * the exact strings The Black Road's import used), so a colored chip fits
 * here the same way `NpcCard`'s status chip does. Substring-matched
 * rather than exact-matched: "lead-only, unrecovered" and "pending
 * recovery" are two words that carry the meaning, not the whole phrase,
 * and a plain gray chip with the real text is a safe fallback for
 * anything this map doesn't recognize. */
function statusColorClass(status: string | null): string {
  const lower = (status ?? '').toLowerCase()
  if (lower.includes('held') || lower.includes('secured') || lower.includes('loan')) return 'border-green/30 text-green'
  if (lower.includes('pending')) return 'border-yellow/30 text-yellow'
  if (lower.includes('contained')) return 'border-orange/30 text-orange'
  if (lower.includes('lead')) return 'border-line-soft text-ink-faint'
  return 'border-line-soft text-ink-dim'
}

/** One treasure item — mockup-approved row shape (denser than
 * `NpcCard`/`FactionCard`: 13 real items is a list to scan, not a set of
 * cards to read one at a time). No GM-only split here either, same
 * reasoning as `FactionCard`: `held_by`/`location` are already
 * party-visible facts, not hidden GM bookkeeping. */
export function TreasureRow({ treasure, className }: TreasureRowProps) {
  const where = [treasure.held_by, treasure.location].filter(Boolean).join(' — ')

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-2.5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cx(text.body, 'font-semibold')}>{treasure.name}</p>
          {treasure.category && <p className={cx(text.label, 'mt-0.5 text-ink-faint')}>{treasure.category}</p>}
        </div>
        {treasure.status && (
          <span className={cx(text.caption, 'shrink-0 rounded-full border px-2.5 py-0.5', statusColorClass(treasure.status))}>
            {treasure.status}
          </span>
        )}
      </div>
      <div className={cx(text.caption, 'mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-ink-dim')}>
        {treasure.quantity_value && <span>{treasure.quantity_value}</span>}
        {where && <span>{where}</span>}
      </div>
      {treasure.notes && <p className={cx(text.caption, 'mt-1.5 text-ink-faint')}>{treasure.notes}</p>}
    </div>
  )
}
