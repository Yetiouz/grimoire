import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

/**
 * Two variants only (style guide §5). Radius is `rounded-button` (11px)
 * — a deliberate, named decision, not full-round: buttons read as
 * buttons; pills (see Badge) read as tags. See the style-guide page's
 * Button section for both shapes side by side.
 *
 * Label text now uses the closed-set `caption` level (was ad-hoc
 * `font-mono text-sm font-semibold`) — caption bakes in no color of its
 * own (see typography.ts), so the per-variant `text-white`/`text-ink`
 * below still owns color with no cascade conflict; `font-semibold` is
 * added back explicitly since caption doesn't bake in a weight either.
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
 */
export function Button({ variant = 'primary', className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cx(
        'inline-flex min-h-11 items-center justify-center rounded-button px-6 py-3 font-semibold transition-[background-color,border-color,transform,opacity] duration-150',
        text.caption,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        variant === 'primary' &&
          'bg-purple text-white shadow-[0_0_0_1px_rgba(155,92,255,0.25),0_8px_24px_-8px_rgba(155,92,255,0.55)] hover:-translate-y-px hover:bg-purple-hover',
        variant === 'ghost' &&
          'border border-line bg-transparent text-ink hover:border-[#33333c] hover:bg-panel2',
        disabled && 'pointer-events-none cursor-not-allowed opacity-40',
        className,
      )}
      {...props}
    />
  )
}
