import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  /** Optional, from the closed icon set (Iconography) — no icon was
   * added to that set specifically for this component; pick whichever
   * of the twelve fits (e.g. `journal` for an empty scene log). Omit for
   * a text-only empty state. */
  icon?: IconName
  title: string
  /** SPEC's own example: "No entries yet — the pages await." Flavor,
   * not filler — every empty state should read like this, not like a
   * blank error. */
  description?: string
  /** Usually a Button (e.g. "Create your first character") — a plain
   * ReactNode so any call-to-action shape fits without EmptyState
   * needing to know about Button's API. */
  action?: ReactNode
  className?: string
}

/** One of SPEC's four required screen states (loading / empty / error /
 * populated). Built on the same card language as Panel, but standalone
 * rather than wrapping one — an empty state IS the whole card, not
 * content inside one. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-card border border-line bg-panel px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <Icon name={icon} />}
      <h3 className={text.h3}>{title}</h3>
      {description && <p className={cx(text.bodySecondary, 'max-w-[40ch]')}>{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
