import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { BadgeTone } from './Badge'

interface TorchTimerProps {
  /** Defaults to "Torch" since it's the only timed light source SPEC
   * currently names, but left overridable (lantern, etc.). */
  label?: string
  minutesRemaining: number
  minutesTotal: number
  /** Caller-decided, same rule as Stat tile: no baked-in "under 5 min =
   * red" threshold logic here — the component displays what it's given. */
  accent?: BadgeTone
  className?: string
}

const accentBarClass: Record<BadgeTone, string> = {
  green: 'bg-green',
  red: 'bg-red',
  yellow: 'bg-yellow',
  orange: 'bg-orange',
  pink: 'bg-pink',
  cyan: 'bg-cyan',
}

/** Stat tile's shape plus a progress bar for a countdown resource. Not
 * in the landing page — new territory for the app's data-display needs. */
export function TorchTimer({
  label = 'Torch',
  minutesRemaining,
  minutesTotal,
  accent = 'orange',
  className,
}: TorchTimerProps) {
  const fraction = minutesTotal > 0 ? Math.min(1, Math.max(0, minutesRemaining / minutesTotal)) : 0
  return (
    <div className={cx('rounded-card border border-line bg-panel px-3 py-2', className)}>
      <p className={text.label}>{label}</p>
      <p className={cx('mt-0.5', text.numeric)}>{minutesRemaining}m</p>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel2"
        role="progressbar"
        aria-label={`${label} remaining`}
        aria-valuenow={minutesRemaining}
        aria-valuemin={0}
        aria-valuemax={minutesTotal}
      >
        <div className={cx('h-full rounded-full', accentBarClass[accent])} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  )
}
