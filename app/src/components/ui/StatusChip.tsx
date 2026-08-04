import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { BadgeTone } from './Badge'

interface StatusChipProps {
  /** Short key, rendered uppercase — e.g. "TORCH". */
  label: string
  /** The value half, e.g. "38M". Rendered as-is, no casing applied. */
  value: string
  /** Optional tone dot, same six-tone set as Badge/StatTile/TorchTimer —
   * no new colors (SPEC's palette decision: adopt the exploration's
   * patterns, not its colors). Omit for a plain neutral chip. */
  tone?: BadgeTone
  className?: string
}

const toneDotClass: Record<BadgeTone, string> = {
  green: 'bg-green',
  red: 'bg-red',
  yellow: 'bg-yellow',
  orange: 'bg-orange',
  pink: 'bg-pink',
  cyan: 'bg-cyan',
}

/** Badge's technical cousin: a mono key:value pill for compact readouts
 * (e.g. "TORCH: 38M") rather than Badge's plain status word. Same pill
 * shape and tone-dot vocabulary as Badge/StatTile/TorchTimer, but the
 * text is `caption` in Chivo Mono throughout — key dim, value bright —
 * instead of Badge's single-color label. */
export function StatusChip({ label, value, tone, className }: StatusChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border border-line-soft bg-panel2 px-3 py-1',
        className,
      )}
    >
      {tone && <span className={cx('h-2 w-2 rounded-full', toneDotClass[tone])} aria-hidden="true" />}
      <span className={cx(text.caption, 'text-ink-faint uppercase tracking-eyebrow')}>{label}:</span>
      <span className={cx(text.caption, 'text-ink')}>{value}</span>
    </span>
  )
}
