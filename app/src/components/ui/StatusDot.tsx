import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TONE_DOT_CLASS } from '../../lib/statusTone'
import type { StatusTone } from '../../lib/statusTone'

// Fields spelled out rather than `extends StatusIndicator` — every
// caller still passes a `StatusIndicator` via `{...indicator}` (that
// object's shape is a structural subset of this one, so it spreads in
// fine), this just avoids interface-extends on a type imported from a
// sibling module for its own sake.
interface StatusDotProps {
  label: string
  tone: StatusTone
  className?: string
}

/** The one status-chip shape every Quest Log tab uses (see
 * `lib/statusTone.ts`'s doc comment for the tone vocabulary this
 * renders) — a small dot carrying the color plus gray-ish text, matching
 * the style guide's existing "Dot-tag" pattern (color lives in the dot
 * only, so several different tones stay legible sitting next to each
 * other). Lives in `ui/`, not `domain/`: nothing about it is specific to
 * quests/NPCs/factions/treasure, it just renders whatever
 * `StatusIndicator` it's given. */
export function StatusDot({ label, tone, className }: StatusDotProps) {
  return (
    <span
      className={cx(
        text.caption,
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-soft bg-panel px-2.5 py-0.5 uppercase tracking-eyebrow text-ink-dim',
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT_CLASS[tone])} />
      {label}
    </span>
  )
}
