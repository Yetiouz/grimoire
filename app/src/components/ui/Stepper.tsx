import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Used only to build the +/- buttons' accessible labels ("Fewer
   * dice"/"More dice") — never rendered visually. */
  label?: string
  className?: string
}

/** Generic +/- numeric control — 44px touch targets each side (SPEC's
 * touch-target minimum), a `numeric` tabular value in between. Split
 * out of `DiceRoller.tsx`'s dice-count control in the retroactive-
 * review pass (that file was 367 lines, over CLAUDE.md's ~300-line
 * cap): there's nothing dice-specific about a +/- stepper, so it lives
 * here rather than staying baked into one screen. */
export function Stepper({ value, onChange, min = 1, max = Infinity, label, className }: StepperProps) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cx(
          'inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel2 text-ink hover:border-line-hover',
          value <= min && 'pointer-events-none opacity-40',
        )}
        aria-label={label ? `Fewer ${label}` : 'Decrease'}
      >
        −
      </button>
      <span className={cx(text.numeric, 'w-6 text-center')}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cx(
          'inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel2 text-ink hover:border-line-hover',
          value >= max && 'pointer-events-none opacity-40',
        )}
        aria-label={label ? `More ${label}` : 'Increase'}
      >
        +
      </button>
    </div>
  )
}
