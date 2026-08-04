import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface DangerBannerProps {
  children: ReactNode
  /** 'danger' (red) — immediate threat, e.g. dying. 'warning' (orange) —
   * cautionary, e.g. a triggered-but-unresolved trap. */
  tone?: 'danger' | 'warning'
  className?: string
}

// CSS var references, same reasoning as DiceResult: the tag's text
// color is set inline (the mechanism Log entry row uses for sender
// color) rather than as a second `text-*` utility class layered on top
// of the closed-set `label` level, because that specificity is unreliable.
const toneConfig: Record<NonNullable<DangerBannerProps['tone']>, { border: string; bg: string; color: string; word: string }> = {
  danger: { border: 'border-red/40', bg: 'bg-red/10', color: 'var(--color-red)', word: 'Danger' },
  warning: { border: 'border-orange/40', bg: 'bg-orange/10', color: 'var(--color-orange)', word: 'Warning' },
}

/** Full-width alert for urgent game-state moments (dying, a triggered
 * trap). Static and presentational — no dismiss or timeout logic built
 * in; the caller decides when it mounts and unmounts. */
export function DangerBanner({ children, tone = 'danger', className }: DangerBannerProps) {
  const config = toneConfig[tone]
  return (
    <div role="alert" className={cx('rounded-card border px-4 py-3', config.border, config.bg, className)}>
      <p className={text.label} style={{ color: config.color }}>
        {config.word}
      </p>
      <p className={cx('mt-1', text.body)}>{children}</p>
    </div>
  )
}
