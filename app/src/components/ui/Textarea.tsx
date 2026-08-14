import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string
  /** Presence alone switches to the error visual state and renders this
   * message below the field. */
  error?: string
  className?: string
}

/**
 * `TextInput`'s multi-line sibling (2026-08-14, `EndSessionReview`'s
 * "next time" note — the first free-text field anywhere in the app
 * that isn't a single line). Same shell — `rounded-button`,
 * `bg-panel2`, the same border/focus-ring treatment, the same
 * label/error slots — so a form mixing both never reads as two
 * different design systems. Font stays plain `text-base` (16px) for
 * the same iOS-Safari-zoom reason `TextInput`'s own doc comment
 * gives; no `forwardRef` consumer needs it yet, unlike `TextInput`,
 * but kept anyway so a future one (autofocus-on-open, say) doesn't
 * need this file touched to add it.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, rows = 3, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = error ? `${fieldId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={fieldId} className={text.label}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cx(
          'resize-none rounded-button border bg-panel2 px-4 py-3 font-sans text-base text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150',
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
})
