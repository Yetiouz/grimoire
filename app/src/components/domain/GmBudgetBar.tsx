import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface GmBudgetBarProps {
  /** Short word identifying which AI this bar tracks — "GM" or
   * "Voice." Shown in the tooltip; the visible text is the percentage
   * (see the component doc comment for why). */
  label: string
  used: number
  limit: number
}

/**
 * Journal header meter (2026-08-10; rewritten same day per owner
 * feedback). One bar per AI — GM text turns, voice reads — each
 * reading its own share of `getGmBudgetByMode`'s split (see that
 * function's doc comment: the CEILING stays the one real shared
 * number `gm_turn/index.ts` enforces; only the USED side is split by
 * mode). Two bars, not one, because the owner asked to "track them
 * truly separately" — watching only your own AI-GM's turns eat into
 * the *shared* pool without knowing whether voice or the GM itself is
 * the reason you're capped would defeat the point of separating them,
 * so each bar's fraction is against the same shared limit rather than
 * a private one per AI.
 *
 * Label reads "N% Used," not the original design's "N left today" —
 * per the owner's follow-up correction: a percentage reads faster at
 * a glance than a raw remaining count, especially with two bars side
 * by side, and "Used" is shorter than the alternatives considered
 * ("N left today", "Live"/"Stub", "Available"/"Unavailable").
 */
export function GmBudgetBar({ label, used, limit }: GmBudgetBarProps) {
  const usedFraction = limit > 0 ? used / limit : 0
  const percent = Math.round(Math.min(1, usedFraction) * 100)
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: ${used} of ${limit} requests used today — the daily pool is shared across GM turns and voice reads.`}
    >
      <span
        className="h-1 w-10 overflow-hidden rounded-full bg-panel2"
        role="img"
        aria-label={`${label}: ${percent} percent of today's shared GM budget used`}
      >
        <span
          className={cx(
            'block h-full rounded-full transition-[width] duration-300',
            usedFraction >= 1 ? 'bg-red' : usedFraction >= 0.8 ? 'bg-yellow' : 'bg-cyan',
          )}
          style={{ width: `${Math.min(100, usedFraction * 100)}%` }}
        />
      </span>
      <span
        className={cx(
          text.label,
          'hidden tabular-nums sm:inline',
          usedFraction >= 1 ? 'text-red' : usedFraction >= 0.8 ? 'text-yellow' : undefined,
        )}
      >
        {label} {percent}% Used
      </span>
    </div>
  )
}
