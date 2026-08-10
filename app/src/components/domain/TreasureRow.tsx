import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { StatusDot } from '../ui/StatusDot'
import type { Treasure } from '../../lib/world'

interface TreasureRowProps {
  treasure: Treasure
  className?: string
}

/** One treasure item — the detail-view shape (2026-08-10: this used to be
 * the list row too; `WorldPreviewRow` took over the always-visible list,
 * so this now only renders inside `WorldDetailOverlay`). Status label/tone
 * come from `lib/statusTone.ts`'s shared `deriveStatusIndicator` (was a
 * component-local `statusColorClass` before the cross-tab unification) —
 * `treasure.status` is real but small/enum-like today (held / pending
 * recovery / lead-only, unrecovered / contained / secured / on loan), so
 * it goes through the same leading-clause-plus-keyword pipeline every
 * other tab's status now does. No GM-only split here, same reasoning as
 * `FactionCard`: `held_by`/`location` are already party-visible facts,
 * not hidden GM bookkeeping. */
export function TreasureRow({ treasure, className }: TreasureRowProps) {
  const where = [treasure.held_by, treasure.location].filter(Boolean).join(' — ')
  const statusIndicator = deriveStatusIndicator(treasure.status)

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-2.5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cx(text.body, 'font-semibold')}>{treasure.name}</p>
          {treasure.category && <p className={cx(text.label, 'mt-0.5 text-ink-faint')}>{treasure.category}</p>}
        </div>
        {statusIndicator && <StatusDot {...statusIndicator} />}
      </div>
      <div className={cx(text.caption, 'mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-ink-dim')}>
        {treasure.quantity_value && <span>{treasure.quantity_value}</span>}
        {where && <span>{where}</span>}
      </div>
      {treasure.notes && <p className={cx(text.caption, 'mt-1.5 text-ink-faint')}>{treasure.notes}</p>}
    </div>
  )
}
