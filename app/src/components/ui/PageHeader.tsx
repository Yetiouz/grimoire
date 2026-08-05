import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface PageHeaderProps {
  /** Left slot of the meta strip — a plain brand mark on Campaigns, a
   * clickable breadcrumb on Journal. Fully caller-styled (same "host
   * owns content, component owns layout" split JournalFeed's `composer`/
   * `filter` slots already use) rather than PageHeader baking in text
   * styling children would have to fight or duplicate. */
  left: ReactNode
  /** Right slot — Sign out on Campaigns, the session meta line on
   * Journal. Optional since Journal's meta line depends on session data
   * that may not be loaded on first render. */
  right?: ReactNode
  title: string
  className?: string
}

/** Shared header band — style-guide Masthead's own direction (a
 * text.label meta strip above a Bebas h1, both inside a bottom-hairline
 * band) scaled to the app screens' narrower max-w-2xl body instead of
 * the style guide's max-w-[65rem]. Campaigns and Journal both compose
 * from this so neither screen floats a bare heading (or, previously, a
 * lone Sign out link) above its content with nothing anchoring it. */
export function PageHeader({ left, right, title, className }: PageHeaderProps) {
  return (
    <header className={cx('border-b border-line', className)}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          {left}
          {right}
        </div>
        <h1 className={text.h1}>{title}</h1>
      </div>
    </header>
  )
}
