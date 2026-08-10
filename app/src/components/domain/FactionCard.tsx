import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { StatusDot } from '../ui/StatusDot'
import type { Faction } from '../../lib/world'

interface FactionCardProps {
  faction: Faction
  className?: string
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className={cx(text.label, 'text-ink-faint')}>{label}</p>
      <p className={cx(text.bodySecondary, 'mt-0.5')}>{value}</p>
    </div>
  )
}

/** One faction — the detail-view shape (2026-08-10: this used to be the
 * list card too; `WorldPreviewRow` took over the always-visible list, so
 * this now only renders inside `WorldDetailOverlay`). Name + status dot,
 * type, a stacked field list (disposition/leader/territory/goal/status),
 * then notes below a divider. The header chip's short label/tone come
 * from `lib/statusTone.ts`'s shared `deriveStatusIndicator` (was a
 * component-local `dispositionLead`/`dispositionDotClass` pair before the
 * cross-tab unification) — `factions.disposition` is real freeform prose
 * ("Allied — sponsoring Kimbo's recovery mission"), so the chip shows
 * only the derived leading clause; the full sentence still renders as its
 * own field below, alongside Leader/Territory/Goal/Status. No GM-only
 * split here (unlike `NpcCard`): faction fields are the kind of thing any
 * party member would plausibly know or infer in play, per the scoping
 * call made alongside the `npc_stat_blocks` migration — only NPC combat
 * stats got the table-level split. */
export function FactionCard({ faction, className }: FactionCardProps) {
  const statusIndicator = deriveStatusIndicator(faction.disposition)

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cx(text.body, 'font-semibold')}>{faction.name}</span>
        {statusIndicator && <StatusDot {...statusIndicator} />}
      </div>
      {faction.type && <p className={cx(text.label, 'mt-0.5 text-ink-faint')}>{faction.type}</p>}

      <div className="mt-2.5 flex flex-col gap-2">
        <Field label="Disposition" value={faction.disposition} />
        <Field label="Leader" value={faction.leader} />
        <Field label="Territory" value={faction.territory} />
        <Field label="Goal" value={faction.goal} />
        <Field label="Status" value={faction.status} />
      </div>

      {faction.notes && <p className={cx(text.caption, 'mt-2.5 border-t border-line-soft pt-2.5 text-ink-faint')}>{faction.notes}</p>}
    </div>
  )
}
