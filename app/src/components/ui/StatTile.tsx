import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { BadgeTone } from './Badge'

interface StatTileProps {
  label: string
  /** ReactNode, not just string/number — real values will look like
   * "12/15" or carry an icon. */
  value: ReactNode
  /** Optional colored left edge (e.g. torch = orange). No color-threshold
   * warning logic ("HP is low") lives here — that needs real game state
   * this component doesn't have yet, so it's deliberately not built. */
  accent?: BadgeTone
  className?: string
}

const accentBorderClass: Record<BadgeTone, string> = {
  green: 'border-l-2 border-l-green',
  red: 'border-l-2 border-l-red',
  yellow: 'border-l-2 border-l-yellow',
  orange: 'border-l-2 border-l-orange',
  pink: 'border-l-2 border-l-pink',
  cyan: 'border-l-2 border-l-cyan',
}

/** Compact label/value tile for a header strip (HP/AC/Gear/Luck/Torch).
 * Not in the landing page's style guide — new territory for the app's
 * data-display needs. */
export function StatTile({ label, value, accent, className }: StatTileProps) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-panel px-3 py-2',
        accent && accentBorderClass[accent],
        className,
      )}
    >
      <p className="text-[11px] uppercase tracking-eyebrow text-ink-faint">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-ink">{value}</p>
    </div>
  )
}
