import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface GmBudgetBarProps {
  remaining: number
  usedFraction: number
  limit: number
  used: number
}

/**
 * Journal header meter (2026-08-10) — the same bar-plus-number shape as
 * `JournalComposer`'s own inline budget meter (a bar answers "should I
 * be worried yet" at a glance; the number answers "how many exactly"),
 * but reachable in campaigns where the composer's meter never renders
 * at all: that one is gated on `aiGmActive` (AI-GM campaigns only, so
 * the Ask GM/Ask Rules chips have something to gate), while read-aloud
 * (`lib/speech.ts`) works in ANY campaign whose build has `VITE_GM_TTS`
 * on — it narrates hand-typed narration same as AI-authored narration,
 * so a solo- or human-GM'd campaign can spend real budget purely on
 * voice reads and would otherwise have no way to see it happening.
 *
 * Deliberately labeled "GM budget," not "voice budget": play turns,
 * rules turns, and voice reads all draw from the one daily pool
 * `gm_turn/index.ts` enforces. A label implying voice has its own
 * separate allowance would be dishonest the first time a player also
 * uses Ask GM and watches this same number move without having spoken
 * a word — see `useGmBudget`'s own doc comment.
 */
export function GmBudgetBar({ remaining, usedFraction, limit, used }: GmBudgetBarProps) {
  return (
    <div
      className="flex items-center gap-2"
      title={`${used} of ${limit} GM requests used today — play, rules, and voice reads all share this. A voice read costs one.`}
    >
      <span
        className="h-1 w-12 overflow-hidden rounded-full bg-panel2"
        role="img"
        aria-label={`${Math.round(usedFraction * 100)} percent of today's GM budget used`}
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
        {remaining} left today
      </span>
    </div>
  )
}
