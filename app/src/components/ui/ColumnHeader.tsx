import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface ColumnHeaderProps {
  left: ReactNode
  right?: ReactNode
  className?: string
}

/**
 * The 38px underlined header row shared by all three of the journal
 * screen's columns (player-view-mockup.html v10's `.rail-meta`/
 * `.col-head` — same rule, same height, just different content per
 * column). Visual-reconciliation fix: before this, only the Quest Log
 * rail had a header row of its own (built inline, not shared); Party
 * and the journal feed had none, so the three columns didn't read as
 * one aligned composition the way the mockup does.
 *
 * `h-[38px]` is a deliberate, cited exception to the closed spacing
 * scale — same category as the composer's fixed-bar clearance rules in
 * index.css: this is a mockup-matched fixed row height, not a spacing
 * decision. Horizontal padding stays on the closed scale (`px-3`, 12px)
 * rather than copying the mockup's 14px exactly, for the same reason
 * the retroactive-review pass wouldn't invent an off-scale value
 * elsewhere.
 */
export function ColumnHeader({ left, right, className }: ColumnHeaderProps) {
  return (
    <div className={cx('flex h-[38px] shrink-0 items-center justify-between gap-3 border-b border-line-soft px-3', className)}>
      <span className={cx(text.label, 'truncate')}>{left}</span>
      {right}
    </div>
  )
}
