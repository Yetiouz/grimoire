import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

export type LogEntryKind = 'narration' | 'action' | 'roll' | 'note' | 'system'

interface LogEntryRowProps {
  senderName: string
  /** Hex color for this sender (SPEC's "one PC color everywhere" rule).
   * Required, not defaulted — every real entry has an owner. Applied via
   * inline style rather than a Tailwind class: this is arbitrary
   * per-character data, not one of the six fixed palette tones, so
   * Tailwind can't generate a class for it at build time. Ignored for
   * 'narration'/'system' kinds — the mockup renders the GM/System voice
   * in a fixed muted tone regardless of who's speaking. */
  senderColor: string
  message: string
  timestamp?: string
  kind?: LogEntryKind
  className?: string
}

const tagLabel: Partial<Record<LogEntryKind, string>> = {
  roll: 'roll',
  note: 'note',
}

/** Scene log / party chat row — five entry kinds per Journal v1's
 * taxonomy (SPEC.md; journal-mockup.html in the repo root is the
 * approved visual spec): narration (GM voice, quiet panel card, muted
 * text), action (a character speaks/acts — the plain default), roll
 * (action plus a ROLL tag; v1 rolls are hand-typed text, no dice engine
 * yet), note (NOTE tag, notes-to-future-self), system (receded style —
 * auto-generated from ledger events in later slices, manually
 * creatable in v1 for imports).
 *
 * Audit-fix from the original 3-kind version: 'system' used to carry
 * the panel-card background that the mockup actually specifies for
 * 'narration' (`.entry.narration{background...}` vs
 * `.entry.system{opacity:0.85}` — no background at all). Fixed here:
 * narration gets the panel card, system gets reduced opacity and
 * smaller/fainter body text instead. */
export function LogEntryRow({
  senderName,
  senderColor,
  message,
  timestamp,
  kind = 'action',
  className,
}: LogEntryRowProps) {
  const muted = kind === 'narration' || kind === 'system'
  const dotColor = muted ? 'var(--color-ink-faint)' : senderColor
  const nameColor = muted ? 'var(--color-ink-dim)' : senderColor
  const tag = tagLabel[kind]

  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-lg px-3 py-2',
        kind === 'narration' && 'border border-line-soft bg-panel',
        kind === 'system' && 'opacity-[0.85]',
        className,
      )}
    >
      {/* mt-1 (4px, "micro") keeps the dot's optical center aligned with
       * the first line of the sender name next to it. */}
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cx(text.caption, 'font-semibold')} style={{ color: nameColor }}>
            {senderName}
          </span>
          {timestamp && <span className={cx(text.caption, 'text-ink-faint')}>{timestamp}</span>}
          {tag && <span className={cx(text.label, 'rounded-full border border-line px-2 py-1')}>{tag}</span>}
        </div>
        <p
          className={cx(
            kind === 'system' ? cx(text.caption, 'text-ink-faint') : text.bodySecondary,
            'max-w-[35ch] sm:max-w-[65ch]',
          )}
        >
          {message}
        </p>
      </div>
    </div>
  )
}
