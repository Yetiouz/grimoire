import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  /** Presence alone switches to the error visual state and renders this
   * message below the field. */
  error?: string
  className?: string
}

/** Journal-v1 prerequisite. Text itself is plain `text-base` (16px) —
 * not the `body` closed-set level, which bakes in a 1.7 line-height
 * tuned for paragraphs, far too tall for a single-line field. 16px is
 * SPEC's mobile-minimum floor for player-facing text and not
 * coincidentally also what keeps iOS Safari from auto-zooming on focus
 * (anything smaller forces the page to zoom in when the field is
 * tapped). `min-h-11` (44px) guarantees the touch-target minimum
 * regardless of font metrics, same reasoning as Button. No ref
 * forwarding — nothing in the kit needs it yet, and no other component
 * here uses forwardRef either; add it if/when a real consumer does. */
export function TextInput({ label, error, id, className, ...props }: TextInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className={text.label}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cx(
          'min-h-11 rounded-button border bg-panel2 px-4 py-3 font-sans text-base text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50',
          error ? 'border-red' : 'border-line focus:border-purple',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <p id={errorId} className={cx(text.caption, 'text-red')}>
          {error}
        </p>
      )}
    </div>
  )
}
