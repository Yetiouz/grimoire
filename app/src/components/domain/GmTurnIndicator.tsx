import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { ThinkingRune } from '../ui/ThinkingRune'
import { GmReply } from './GmReply'
import type { PendingGmTurn } from '../../lib/gm'

/**
 * The feed's own thinking/settled row (2026-08-18) — moved out of
 * `JournalComposer` per the owner's redesign: "the animation needs to
 * go outside the box, in the chat feed itself... when it's stopped it
 * acts like an indicator of where we are." `JournalFeed` renders this
 * as the last row in the list, right where the next reply will land,
 * whenever the host layout's `pendingTurn` state (lifted out of
 * `JournalComposer`, see `PendingGmTurn`'s own doc comment) is non-null.
 *
 * Two phases, one continuous rune:
 * - 'thinking': the animated rune + status text — same markup the
 *   composer used to show next to the input, just relocated.
 * - 'settled': the SAME rune, animation stopped dead (`ThinkingRune`'s
 *   `frozen` prop) rather than swapped for a different glyph, faded to
 *   `text-ink-faint` so the vivid mode color (cyan/orange) reads as
 *   "was active" and the fade reads as "now at rest." It sits beside
 *   the existing `GmReply` strip — that component already carries the
 *   right tone/label/message for whatever this settled into (stopped,
 *   a brake, budget_exhausted, an error, or an unfiled ok reply) and
 *   already has its own dismiss control, so this doesn't duplicate any
 *   of that, it just gives the outcome a resting mark to sit next to.
 *   A reply that made it into the journal never reaches this component
 *   at all — the composer clears `pendingTurn` straight to `null` and
 *   the real entry in the feed is the resting mark.
 */
export function GmTurnIndicator({ pending, onDismiss }: { pending: PendingGmTurn; onDismiss: () => void }) {
  const rulesMode = pending.mode === 'rules'

  if (pending.phase === 'thinking') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cx(
          'flex items-center gap-2.5 rounded-card border px-3 py-2.5',
          rulesMode ? 'border-orange/30 bg-orange/[0.07]' : 'border-cyan/30 bg-cyan/[0.07]',
        )}
      >
        <ThinkingRune
          label=""
          className="h-6 w-6"
          style={{ color: rulesMode ? '#ff8a3d' : '#35f0ff' }}
        />
        <span className={cx(text.body, rulesMode ? 'text-orange' : 'text-cyan')}>
          {rulesMode ? 'Checking the rules…' : 'The GM is thinking…'}
        </span>
      </div>
    )
  }

  if (!pending.result) return null

  return (
    <div className="flex items-start gap-2.5">
      <ThinkingRune label="" frozen className="mt-2.5 h-6 w-6 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <GmReply result={pending.result} onDismiss={onDismiss} />
      </div>
    </div>
  )
}
