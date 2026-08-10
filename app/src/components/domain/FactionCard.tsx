import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Faction } from '../../lib/world'

interface FactionCardProps {
  faction: Faction
  className?: string
}

/** `factions.disposition` is real freeform prose in The Black Road's data
 * ("Allied — sponsoring Kimbo's recovery mission", "Hostile — murdered
 * Orren Vey…"), not a clean two-value enum. The header chip shows only
 * the leading word (a real short-enough label to fit a pill shape,
 * matching `npcs.status`'s treatment in `NpcCard`) with a color derived
 * from it; the full sentence renders further down as its own field,
 * alongside Leader/Territory/Goal/Status, rather than being crammed into
 * the chip. Falls back to a neutral gray dot/label for anything that
 * doesn't start with one of the two known words. */
function dispositionLead(disposition: string | null): string | null {
  if (!disposition) return null
  const dashIndex = disposition.indexOf('—')
  return (dashIndex > -1 ? disposition.slice(0, dashIndex) : disposition).trim()
}
function dispositionDotClass(disposition: string | null): string {
  const lower = (disposition ?? '').toLowerCase()
  if (lower.startsWith('allied')) return 'bg-green'
  if (lower.startsWith('hostile')) return 'bg-red'
  return 'bg-ink-faint'
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

/** One faction — mockup-approved shape: name + disposition chip, type,
 * a stacked field list (leader/territory/goal/status), then notes below
 * a divider. No GM-only split here (unlike `NpcCard`): faction fields are
 * the kind of thing any party member would plausibly know or infer in
 * play, per the scoping call made alongside the `npc_stat_blocks`
 * migration — only NPC combat stats got the table-level split. */
export function FactionCard({ faction, className }: FactionCardProps) {
  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cx(text.body, 'font-semibold')}>{faction.name}</span>
        {faction.disposition && (
          <span
            className={cx(
              text.caption,
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-soft bg-panel px-2.5 py-0.5 text-ink-dim',
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', dispositionDotClass(faction.disposition))} />
            {dispositionLead(faction.disposition)}
          </span>
        )}
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
