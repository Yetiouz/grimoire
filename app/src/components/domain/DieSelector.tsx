import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { DieIcon } from '../ui/DieIcon'
import type { DieType } from '../../lib/dice'

const DIE_OPTIONS: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

interface DieSelectorProps {
  value: DieType
  onChange: (die: DieType) => void
  className?: string
}

/** The die-shape chip row — icon-over-label tiles, one per supported
 * die (BUILD_PLAN.md slice 4, plus the later d100 follow-up). Split out
 * of `DiceRoller.tsx` in the retroactive-review pass (that file was 367
 * lines, over CLAUDE.md's ~300-line cap) — also a clean reuse boundary
 * if a future screen ever needs a bare die picker on its own.
 *
 * Scrolls horizontally instead of wrapping (owner's mobile pass, second
 * round: on a real phone all seven tiles at their touch-target size
 * don't fit one row, and the previous `flex-wrap` left the seventh —
 * d100 — stranded alone on an orphaned second line, which read worse
 * and cost more vertical space than a normal row would have). `shrink-0`
 * on each tile stops flex from squeezing them to fit instead of letting
 * the row actually overflow and scroll, which is the whole point here.
 * Not reordered to put the default (d20) first: on the phone width this
 * was diagnosed against, six of the seven tiles — d4 through d20 —
 * already fit in the initial, unscrolled view, so the default selection
 * is visible without any scrolling; only d100 needs a swipe to reach. */
export function DieSelector({ value, onChange, className }: DieSelectorProps) {
  return (
    <div className={cx('flex gap-2 overflow-x-auto', className)} role="radiogroup" aria-label="Die">
      {DIE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cx(
            'flex shrink-0 flex-col items-center justify-center gap-1 rounded-button border px-3 py-2',
            value === option
              ? 'border-purple bg-purple text-white'
              : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
          )}
        >
          <DieIcon die={option} />
          <span className={cx(text.caption, 'uppercase')}>{option}</span>
        </button>
      ))}
    </div>
  )
}
