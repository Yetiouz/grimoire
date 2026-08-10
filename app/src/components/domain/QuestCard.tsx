import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Quest } from '../../lib/quests'

interface QuestCardProps {
  quest: Quest
  className?: string
}

/**
 * One quest — title, its real `status` string, the `goal` line, and a
 * claimant if one exists. `status` renders as plain text rather than
 * through Badge's six-tone system: the real imported data isn't a clean
 * enum ("Active", "Lead", "Personal", but also "Accepted; complete if
 * safely possible" and "Hester recruited; Tobin remains a lead") —
 * mapping freeform status prose onto a fixed tone would mean inventing a
 * categorization the source data doesn't have, the same call
 * TalentRow/SpellCard/GearSlotGrid made earlier in this project rather
 * than fabricating structure imported text doesn't carry.
 *
 * `status` was originally a `shrink-0 rounded-full` pill sitting next to
 * the title in the header row — a shape built for a short state word,
 * not full sentences. The two examples above are real data, not edge
 * cases, so it moved to its own full-width line under the title instead
 * (2026-08-10, "too long for where they are at"): the pill's rounded-full
 * shape reads fine for one line but goes visually strange once text
 * wraps to two or three, and `shrink-0` was forcing the title to give up
 * space to a badge that never actually fit. Plain text wraps like `goal`
 * already does, at any length, with no shape fighting the content.
 */
export function QuestCard({ quest, className }: QuestCardProps) {
  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-4 py-3', className)}>
      <h3 className={cx(text.body, 'font-semibold')}>{quest.title}</h3>
      <p className={cx(text.caption, 'mt-1 text-ink-dim')}>{quest.status}</p>
      {quest.goal && <p className={cx(text.bodySecondary, 'mt-1')}>{quest.goal}</p>}
      {quest.claimant && <p className={cx(text.caption, 'mt-2 text-ink-faint')}>Claimant: {quest.claimant}</p>}
    </div>
  )
}
