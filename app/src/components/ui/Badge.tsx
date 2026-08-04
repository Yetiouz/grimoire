import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

export type BadgeTone = 'green' | 'red' | 'yellow' | 'orange' | 'pink' | 'cyan'

interface BadgeProps {
  children: ReactNode
  tone: BadgeTone
  /**
   * 'status' — a single-instance status line (style guide §5, "Eyebrow /
   * status tag", e.g. "in development"): panel background, line border.
   * 'indicator' — one of several shown together in a row (style guide
   * §5, "Dot-tag"): panel2 background, line-soft border. Defaults to
   * 'indicator' since that's the more common multi-item case.
   */
  variant?: 'status' | 'indicator'
  className?: string
}

const toneDotClass: Record<BadgeTone, string> = {
  green: 'bg-green',
  red: 'bg-red',
  yellow: 'bg-yellow',
  orange: 'bg-orange',
  pink: 'bg-pink',
  cyan: 'bg-cyan',
}

/** Pill-shaped, always full-round (Tailwind's built-in rounded-full) —
 * this is the "tag" shape, deliberately distinct from Button's
 * rounded-button. Color lives in the dot only (style guide §5: keeps a
 * row legible even with several different tones side by side).
 *
 * Label text uses the closed-set `caption` level (was ad-hoc `text-xs`)
 * with an explicit `text-ink` — caption bakes in no color of its own,
 * see typography.ts. Dot is `h-2 w-2` (8px, on the spacing scale) —
 * was `h-1.5 w-1.5` (6px, off-scale), bumped to match LogEntryRow's
 * sender dot, which already used 8px. */
export function Badge({ children, tone, variant = 'indicator', className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1',
        text.caption,
        'text-ink',
        variant === 'status' ? 'border-line bg-panel' : 'border-line-soft bg-panel2',
        className,
      )}
    >
      <span className={cx('h-2 w-2 rounded-full', toneDotClass[tone])} aria-hidden="true" />
      {children}
    </span>
  )
}
