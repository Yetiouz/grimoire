import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface SceneDividerProps {
  children: ReactNode
  className?: string
}

/** Typographic scene/chapter break — a centered label flanked by rule
 * lines. No icon or ornament dependency; iconography is a separate,
 * not-yet-built system. */
export function SceneDivider({ children, className }: SceneDividerProps) {
  return (
    <div className={cx('flex items-center gap-4', className)} role="separator">
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      <span className={text.label}>{children}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  )
}
