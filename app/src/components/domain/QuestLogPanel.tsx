import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { ColumnHeader } from '../ui/ColumnHeader'
import { QuestCard } from './QuestCard'
import type { Quest } from '../../lib/quests'

interface QuestLogPanelProps {
  quests: Quest[]
  className?: string
}

/**
 * The persistent Quest Log (BUILD_PLAN.md slice 5) — always rendered,
 * no click needed to see it, per the vision-handoff mockup
 * (`player-view-mockup.html`'s always-visible right rail). The count in
 * the header is a plain total, not a filtered "N Active" count like the
 * mockup's own `.col-head`: the real `status` values aren't a clean
 * Active/Done split (see QuestCard's own comment), so filtering by a
 * status the data doesn't cleanly express would mean fabricating a
 * category. `JournalScreen` decides where this renders (a right rail
 * on wide viewports, stacked content on narrow ones) — this component
 * just lays out whatever list it's given.
 *
 * Header now goes through the shared `ColumnHeader` (visual-
 * reconciliation pass) instead of its own bespoke bar, so this column
 * lines up pixel-for-pixel with Party's and the journal feed's headers
 * rather than sitting at a slightly different height/padding.
 */
export function QuestLogPanel({ quests, className }: QuestLogPanelProps) {
  return (
    <div className={cx('flex flex-col', className)}>
      <ColumnHeader
        left="Quest Log"
        right={<span className={text.label}>{quests.length} {quests.length === 1 ? 'Quest' : 'Quests'}</span>}
      />
      <div className="flex flex-col gap-2 pt-3">
        {quests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  )
}
