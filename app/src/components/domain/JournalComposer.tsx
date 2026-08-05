import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Button } from '../ui/Button'
import type { LogEntryKind } from '../ui/LogEntryRow'

const KIND_CHIPS: { kind: LogEntryKind; label: string }[] = [
  { kind: 'action', label: 'Action' },
  { kind: 'narration', label: 'Narration' },
  { kind: 'roll', label: 'Roll' },
  { kind: 'note', label: 'Note' },
]

interface JournalComposerProps {
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Gates the whole composer per the approved plan: no entry can be
   * logged before a session is explicitly started, and there's no
   * separate "end session" control — starting the next session is how
   * one ends (Amendment 2). */
  sessionOpen: boolean
  className?: string
}

/** Kind selector chips + text field + Log button (journal-mockup.html's
 * `.composer`). System isn't offered here — v1's system entries are
 * either auto-generated from ledger events (later slices) or
 * hand-created for imports, not something a player logs mid-session. */
export function JournalComposer({ onLog, sessionOpen, className }: JournalComposerProps) {
  const [kind, setKind] = useState<LogEntryKind>('action')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = !sessionOpen || submitting

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || disabled) return
    setSubmitting(true)
    try {
      await onLog(kind, trimmed)
      setBody('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Entry kind">
        {KIND_CHIPS.map((chip) => (
          <button
            key={chip.kind}
            type="button"
            role="radio"
            aria-checked={kind === chip.kind}
            onClick={() => setKind(chip.kind)}
            disabled={!sessionOpen}
            className={cx(
              // Round 2: these are compact filter-style chips (journal-
              // mockup.html's `.kind`, padding:5px 12px), not touch-target
              // buttons — matched to Badge/StatusChip's own compact-pill
              // padding (px-3 py-1) instead of Button's px-4 py-2, and
              // `min-h-11` is deliberately dropped here. That's a scoped,
              // intentional exception to CLAUDE.md's standing "every
              // interactive control gets the 44px touch-target minimum"
              // rule — decided directly by the user for this dense
              // chip-row pattern, not a change to the rule itself.
              // `uppercase` on the label is the same per-component
              // pattern as Button.tsx (not baked into shared `caption`,
              // which Badge/LogEntryRow/Typography still use un-cased) —
              // also a direct user request, overriding the mockup's own
              // title-case chip labels.
              'inline-flex items-center justify-center rounded-full border px-3 py-1 uppercase',
              text.caption,
              kind === chip.kind
                ? 'border-purple bg-purple text-white'
                : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
              !sessionOpen && 'pointer-events-none opacity-40',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <TextInput
            value={body}
            onChange={(event: { target: { value: string } }) => setBody(event.target.value)}
            onKeyDown={(event: { key: string }) => {
              if (event.key === 'Enter') void handleSubmit()
            }}
            placeholder={sessionOpen ? 'Add to the journal…' : 'Start a session to log entries'}
            disabled={disabled}
            className="w-full"
            aria-label="Journal entry"
          />
        </div>
        <Button onClick={() => void handleSubmit()} disabled={disabled || !body.trim()}>
          Log
        </Button>
      </div>
    </div>
  )
}
