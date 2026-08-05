import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface SkeletonProps {
  /** Sizes the bar — e.g. `"h-4 w-32"` for a text line, `"h-16 w-16
   * rounded-full"` for an avatar. A deliberately unopinionated primitive
   * (like Panel): callers compose real loading shapes (a stat-tile
   * skeleton, a log-row skeleton) from one or more of these rather than
   * this component trying to predict every shape in advance. */
  className?: string
}

/** A single pulsing placeholder bar. Always `aria-hidden` — it's
 * decorative, the actual "loading" announcement belongs on
 * SkeletonGroup (or an equivalent status container) wrapping one or
 * more of these, not repeated on every bar. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-panel2', className)} />
}

interface SkeletonGroupProps {
  children: ReactNode
  /** Announced to screen readers while the group is on screen — e.g.
   * "Loading character sheet". Defaults to a generic "Loading". */
  label?: string
  className?: string
}

/** The accessible wrapper Skeleton needs: `role="status"` +
 * `aria-label` so assistive tech announces once, at the group level,
 * instead of once per bar (or never, if a call site forgot). */
export function SkeletonGroup({ children, label = 'Loading', className }: SkeletonGroupProps) {
  return (
    <div role="status" aria-label={label} className={cx('flex flex-col gap-2', className)}>
      {children}
    </div>
  )
}
