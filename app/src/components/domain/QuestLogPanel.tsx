import { cx } from '../../lib/cx'
import { QuestCard } from './QuestCard'
import type { Quest } from '../../lib/quests'

interface QuestLogPanelProps {
  quests: Quest[]
  className?: string
}

/**
 * The persistent Quest Log list (BUILD_PLAN.md slice 5) — always
 * rendered, no click needed to see it, per the vision-handoff mockup
 * (`player-view-mockup.html`'s always-visible right rail).
 *
 * Just the list now: the card shell (header + scroll wrapper) moved
 * out to `JournalScreen`'s shared `ColumnCard` (the v11 layout-
 * primitive extraction) so all four of the screen's columns own their
 * shell the same way, through one component, instead of this panel
 * hand-rolling a second copy of the identical header/scroll pattern.
 * `JournalScreen` still decides where this renders (a right rail on
 * wide viewports, stacked content on narrow ones) and still owns the
 * "N Quests" header count — this component's job is purely "given
 * quests, render quest cards."
 */
export function QuestLogPanel({ quests, className }: QuestLogPanelProps) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {quests.map((quest) => (
        <QuestCard key={quest.id} quest={quest} />
      ))}
    </div>
  )
}
