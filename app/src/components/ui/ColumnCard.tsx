import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { ColumnHeader } from './ColumnHeader'

interface ColumnCardProps {
  headerLeft: ReactNode
  headerRight?: ReactNode
  /** Pinned, non-scrolling strip between the ColumnHeader and the
   * scrolling body — the journal card's filter bar is the only user
   * today. Exists because anything rendered as the body's first child
   * scrolls away with the feed (that's how the filter bar shipped
   * broken: present in the DOM, thousands of pixels above the scroll
   * viewport on a long campaign). Mirrors `footer` exactly, border on
   * the opposite edge. */
  subheader?: ReactNode
  /** Pinned, non-scrolling footer — the journal card's composer is the
   * only user today. Omit for cards with no footer (Party, Tools,
   * Quest Log). */
  footer?: ReactNode
  /** Gap/layout classes for the scrolling body, e.g. `"gap-2"` for a
   * list of cards or `"gap-4"` for the journal feed's looser rhythm.
   * No default on purpose: `cx` (lib/cx.ts) is a plain className
   * joiner with no tailwind-merge dedup, so a baked-in default gap
   * here would sit *alongside* a caller's override in the class list
   * rather than being replaced by it — which one actually wins would
   * depend on Tailwind's generated stylesheet order, not the order
   * classes appear in the string. Every call site states its own gap
   * explicitly instead of relying on one winning by luck. */
  bodyClassName?: string
  className?: string
  children: ReactNode
}

/**
 * The card-shell layout primitive (CLAUDE.md, v11): every column/panel
 * on an app screen is `rounded-card border-line bg-panel` + a 38px
 * `ColumnHeader` + an internally-scrolling body (`min-h-0` +
 * `overflow-y-auto`) + an optional pinned footer. `JournalScreen`
 * already built this shape correctly by hand for its three (four,
 * counting Tools as its own card) columns — this extracts it into one
 * component so the pattern is enforced by reuse, not repeated by
 * memory at the next call site. CLAUDE.md's explicit first task for
 * this slice.
 */
export function ColumnCard({ headerLeft, headerRight, subheader, footer, bodyClassName, className, children }: ColumnCardProps) {
  return (
    <div className={cx('flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-panel', className)}>
      <ColumnHeader left={headerLeft} right={headerRight} />
      {subheader && <div className="shrink-0 border-b border-line-soft bg-panel p-3">{subheader}</div>}
      <div className={cx('flex min-h-0 flex-1 flex-col overflow-y-auto p-3', bodyClassName)}>{children}</div>
      {footer && <div className="shrink-0 border-t border-line-soft bg-panel p-3">{footer}</div>}
    </div>
  )
}
