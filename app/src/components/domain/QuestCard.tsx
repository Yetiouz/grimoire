import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Quest } from '../../lib/quests'

interface QuestCardProps {
  quest: Quest
  className?: string
}

/**
 * One quest — title, its real `status` string, the `goal` line, and a
 * claimant if one exists. `status` renders as plain text in a neutral
 * pill rather than through Badge's six-tone system: the real imported
 * data isn't a clean enum ("Active", "Lead", "Personal", but also
 * "Accepted; complete if safely possible" and "Hester recruited; Tobin
 * remains a lead") — mapping freeform status prose onto a fixed tone
 * would mean inventing a categorization the source data doesn't have,
 * the same call TalentRow/SpellCard/GearSlotGrid made earlier in this
 * project rather than fabricating structure imported text doesn't
 * carry.
 */
export function QuestCard({ quest, className }: QuestCardProps) {
  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-4 py-3', className)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={cx(text.body, 'font-semibold')}>{quest.title}</h3>
        <span
          className={cx(
            text.caption,
            'shrink-0 rounded-full border border-line-soft bg-panel px-2 py-0.5 text-ink-dim',
          )}
        >
          {quest.status}
        </span>
      </div>
      {quest.goal && <p className={cx(text.bodySecondary, 'mt-1')}>{quest.goal}</p>}
      {quest.claimant && <p className={cx(text.caption, 'mt-2 text-ink-faint')}>Claimant: {quest.claimant}</p>}
    </div>
  )
}
