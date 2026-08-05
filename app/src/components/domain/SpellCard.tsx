import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface SpellCardProps {
  /** Bare spell name from `characters.sheet.spells` — the imported
   * sheets store names only, no tier/range/lock-state data
   * (`player-view-mockup.html`'s `.spell` row shows "Tier 1 · Near" and
   * a locked/ready state per spell, neither of which exists in the real
   * data). The "Ready" chip below is shown unconditionally rather than
   * inventing a lock state — every imported spell is assumed available
   * absent any rest-tracking data to say otherwise. */
  name: string
  className?: string
}

/** One row in a character's Spells list — the mockup's `.spell` visual,
 * scoped down to what the real data actually has. */
export function SpellCard({ name, className }: SpellCardProps) {
  return (
    <div className={cx('flex items-baseline gap-3 border-b border-line-soft px-2 py-2 last:border-b-0', text.bodySecondary, className)}>
      <span>{name}</span>
      <span className={cx(text.caption, 'ml-auto shrink-0 rounded-full border border-green/30 px-2 py-0.5 uppercase tracking-eyebrow text-green')}>
        Ready
      </span>
    </div>
  )
}
