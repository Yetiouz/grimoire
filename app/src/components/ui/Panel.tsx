import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface PanelProps {
  children: ReactNode
  /**
   * Set for panels that are themselves clickable (style guide §3: hover
   * lightens the border to `line-hover` and lifts slightly). Leave off
   * for plain static containers — most panels aren't buttons.
   */
  interactive?: boolean
  /**
   * The activation handler. Only when both `interactive` and `onClick`
   * are set does the panel become a real keyboard-operable control —
   * `role="button"`, focusable, Enter/Space activate it, and it gets a
   * focus ring. `interactive` alone (no handler) is presentational only
   * — no fake button semantics for something that does nothing when
   * "pressed" (the style guide's own demo cell is exactly this case
   * without an onClick).
   */
  onClick?: () => void
  className?: string
}

/** Base card container. Every other data-display component (StatTile,
 * LogEntryRow) can sit inside one, or stand alone.
 *
 * Audit-fix: `interactive` used to be hover styling only — no real
 * click/keyboard path existed to make it an actual control, so a mouse
 * user could "click" a card a keyboard user couldn't activate at all.
 * `onClick` is optional specifically so purely visual `interactive`
 * demos (see the style guide's Panel section) don't get button
 * semantics attached to nothing. */
export function Panel({ children, interactive = false, onClick, className }: PanelProps) {
  const activatable = interactive && Boolean(onClick)

  return (
    <div
      className={cx(
        'rounded-card border border-line bg-panel p-4',
        interactive &&
          'cursor-pointer transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-hover',
        activatable &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className,
      )}
      role={activatable ? 'button' : undefined}
      tabIndex={activatable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        activatable
          ? (event: { key: string; preventDefault: () => void }) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
