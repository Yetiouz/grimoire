import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from './Button'

interface ErrorBannerProps {
  children: ReactNode
  /** Optional retry affordance — most request/load failures are
   * retryable, so this is common enough to build in rather than have
   * every call site reach for its own Button underneath. Omit for a
   * genuinely unrecoverable error. */
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/** One of SPEC's four required screen states (loading / empty / error /
 * populated). DangerBanner's shape (label + body, same alert role), but
 * for request/data failures rather than in-fiction danger — always
 * red, no danger/warning tone split, since an app error has one
 * severity, not two. */
export function ErrorBanner({ children, onRetry, retryLabel = 'Retry', className }: ErrorBannerProps) {
  return (
    <div role="alert" className={cx('rounded-card border border-red/40 bg-red/10 px-4 py-3', className)}>
      <p className={text.label} style={{ color: 'var(--color-red)' }}>
        Error
      </p>
      <p className={cx('mt-1', text.body)}>{children}</p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="ghost" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
