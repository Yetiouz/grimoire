import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

/**
 * Two variants only (style guide §5). Radius is `rounded-button` (11px)
 * — a deliberate, named decision, not full-round: buttons read as
 * buttons; pills (see Badge) read as tags. See the style-guide page's
 * Button section for both shapes side by side.
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
        'rounded-button px-6 py-3 text-sm font-semibold transition-[background-color,border-color,transform,opacity] duration-150',
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
