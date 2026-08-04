import { cx } from '../../lib/cx'

interface LogEntryRowProps {
  senderName: string
  /** Hex color for this sender (SPEC's "one PC color everywhere" rule).
   * Required, not defaulted — every real entry has an owner. Applied via
   * inline style rather than a Tailwind class: this is arbitrary
   * per-character data, not one of the six fixed palette tones, so
   * Tailwind can't generate a class for it at build time. */
  senderColor: string
  message: string
  timestamp?: string
  kind?: 'default' | 'system' | 'roll'
  className?: string
}

/** Scene log / party chat row. Not in the landing page's style guide —
 * new territory for the app's data-display needs. */
export function LogEntryRow({
  senderName,
  senderColor,
  message,
  timestamp,
  kind = 'default',
  className,
}: LogEntryRowProps) {
  return (
    <div className={cx('flex items-start gap-3 rounded-lg px-3 py-2', kind === 'system' && 'bg-panel2', className)}>
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: senderColor }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: senderColor }}>
            {senderName}
          </span>
          {timestamp && <span className="text-xs text-ink-faint">{timestamp}</span>}
          {kind === 'roll' && (
            <span className="text-[10px] uppercase tracking-eyebrow text-ink-faint">roll</span>
          )}
        </div>
        <p className="text-sm text-ink-dim">{message}</p>
      </div>
    </div>
  )
}
