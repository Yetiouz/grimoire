import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'dashed'
}

/**
 * Three variants (style guide §5 documents the original two; `dashed`
 * added 2026-08-11). Radius is `rounded-button` (11px)
 * — a deliberate, named decision, not full-round: buttons read as
 * buttons; pills (see Badge) read as tags. See the style-guide page's
 * Button section for both shapes side by side.
 *
 * Label text now uses the closed-set `caption` level (was ad-hoc
 * `font-mono text-sm font-semibold`) — caption bakes in no color of its
 * own (see typography.ts), so the per-variant `text-white`/`text-ink`
 * below still owns color with no cascade conflict; `font-semibold` is
 * added back explicitly since caption doesn't bake in a weight either.
 * `uppercase` is added here rather than on `caption` itself, same
 * reasoning as `display`'s wordmark casing: `caption` is shared with
 * contexts where forcing uppercase would be wrong (a sender's actual
 * name in LogEntryRow, Badge's label) — Button-specific styling stays
 * on Button.
 *
 * `min-h-11` (44px) guarantees the SPEC touch-target minimum
 * independent of text metrics — caption is smaller than the old
 * text-sm, so padding + line-height alone would land a couple px short.
 * `inline-flex items-center justify-center` keeps the label centered in
 * that guaranteed box instead of just top-aligned.
 *
 * The focus-visible ring isn't in the style guide (the landing page
 * never needed keyboard-focus styling on a marketing CTA) — it's a
 * small, necessary addition for a real interactive control.
 *
 * `dashed`: the "add a new one" placeholder-tile look (Character
 * Builder's entry point on the Party card). Started as a one-off
 * hand-rolled `<button>` in `JournalDesktopLayout`/`MobileJournalView`
 * — a visual review caught that it skipped every shared guarantee this
 * component exists to give (44px touch target, `rounded-button` instead
 * of a stray arbitrary radius, the uppercase label treatment every
 * other button gets), so it was promoted to a real variant here instead
 * of leaving two drifting hand-rolled copies. Keeps its dashed border
 * and faint-to-purple hover as the visual cue that it adds a new item
 * rather than acting on an existing one.
 */
export function Button({ variant = 'primary', className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cx(
        'inline-flex min-h-11 items-center justify-center rounded-button px-6 py-3 font-semibold uppercase transition-[background-color,border-color,transform,opacity] duration-150',
        text.caption,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        variant === 'primary' &&
          'bg-purple text-white shadow-[0_0_0_1px_rgba(155,92,255,0.25),0_8px_24px_-8px_rgba(155,92,255,0.55)] hover:-translate-y-px hover:bg-purple-hover',
        variant === 'ghost' &&
          'border border-line bg-transparent text-ink hover:border-line-hover hover:bg-panel2',
        variant === 'dashed' &&
          'border border-dashed border-line-hover bg-transparent text-ink-faint hover:border-purple hover:text-purple',
        disabled && 'pointer-events-none cursor-not-allowed opacity-40',
        className,
      )}
      {...props}
    />
  )
}
