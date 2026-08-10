import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { StatusDot } from '../ui/StatusDot'
import type { Quest } from '../../lib/quests'

interface QuestCardProps {
  quest: Quest
  className?: string
}

/**
 * One quest — the detail-view shape (2026-08-10: this used to be the
 * always-visible list card too; `WorldPreviewRow` took over that list, so
 * this now only renders inside `WorldDetailOverlay`). Title, the real
 * full `status` string, the `goal` line, and a claimant if one exists.
 *
 * `status` used to render as plain text only, with no chip at all — the
 * real imported data isn't a clean enum ("Accepted; complete if safely
 * possible", "Hester recruited; Tobin remains a lead"), and mapping
 * freeform status prose onto a fixed tone would have meant inventing a
 * categorization the source data doesn't have. `lib/statusTone.ts`'s
 * cross-tab unification (owner's call, alongside the preview/detail
 * split) resolves that differently: `deriveStatusIndicator` takes the
 * LEADING CLAUSE only ("Accepted", "Hester recruited") for the chip,
 * rather than the whole sentence — short enough to fit a pill without
 * fabricating a category the data doesn't have. The full original string
 * still renders below it in full, same as before, so nothing is lost by
 * adding the chip.
 */
export function QuestCard({ quest, className }: QuestCardProps) {
  const statusIndicator = deriveStatusIndicator(quest.status)

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-4 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={cx(text.body, 'font-semibold')}>{quest.title}</h3>
        {statusIndicator && <StatusDot {...statusIndicator} />}
      </div>
      <p className={cx(text.caption, 'mt-1 text-ink-dim')}>{quest.status}</p>
      {quest.goal && <p className={cx(text.bodySecondary, 'mt-1')}>{quest.goal}</p>}
      {quest.claimant && <p className={cx(text.caption, 'mt-2 text-ink-faint')}>Claimant: {quest.claimant}</p>}
    </div>
  )
}
