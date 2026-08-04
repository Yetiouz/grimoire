import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

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
      {/* mt-1 (4px, "micro") — was mt-1.5 (6px, off the closed spacing
       * scale); the nearest on-scale value reads the same visually. */}
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: senderColor }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {/* Sender name/timestamp purged from ad-hoc text-sm/text-xs to
         * the closed-set `caption` level. caption bakes in no color
         * (see typography.ts), so senderColor still applies inline
         * (same per-character-hex mechanism this component already
         * uses on the dot above) and the timestamp gets an explicit
         * text-ink-faint. */}
        <div className="flex items-baseline gap-2">
          <span className={cx(text.caption, 'font-semibold')} style={{ color: senderColor }}>
            {senderName}
          </span>
          {timestamp && <span className={cx(text.caption, 'text-ink-faint')}>{timestamp}</span>}
          {kind === 'roll' && <span className={text.label}>roll</span>}
        </div>
        <p className={cx(text.bodySecondary, 'max-w-[35ch] sm:max-w-[65ch]')}>{message}</p>
      </div>
    </div>
  )
}
