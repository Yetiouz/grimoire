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
 * if a future screen ever needs a bare die picker on its own. */
export function DieSelector({ value, onChange, className }: DieSelectorProps) {
  return (
    <div className={cx('flex flex-wrap gap-2', className)} role="radiogroup" aria-label="Die">
      {DIE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cx(
            'flex flex-col items-center justify-center gap-1 rounded-button border px-3 py-2',
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
