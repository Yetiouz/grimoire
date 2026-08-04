import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface PanelProps {
  children: ReactNode
  /**
   * Set for panels that are themselves clickable (style guide §3: hover
   * lightens the border to #33333c and lifts slightly). Leave off for
   * plain static containers — most panels aren't buttons.
   */
  interactive?: boolean
  className?: string
}

/** Base card container. Every other data-display component (StatTile,
 * LogEntryRow) can sit inside one, or stand alone. */
export function Panel({ children, interactive = false, className }: PanelProps) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-panel p-4',
        interactive &&
          'cursor-pointer transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#33333c]',
        className,
      )}
    >
      {children}
    </div>
  )
}
