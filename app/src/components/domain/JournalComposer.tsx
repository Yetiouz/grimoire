import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Button } from '../ui/Button'
import type { LogEntryKind } from '../ui/LogEntryRow'
import { getGmBudget } from '../../lib/gm'
import { GmReply } from './GmReply'
import type { GmBudget, GmTurnResult } from '../../lib/gm'

const KIND_CHIPS: { kind: LogEntryKind; label: string }[] = [
  { kind: 'action', label: 'Action' },
  { kind: 'narration', label: 'Narration' },
  { kind: 'roll', label: 'Roll' },
  { kind: 'note', label: 'Note' },
]

type Mode = 'log' | 'gm'

interface JournalComposerProps {
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Gates the whole composer per the approved plan: no entry can be
   * logged before a session is explicitly started, and there's no
   * separate "end session" control — starting the next session is how
   * one ends (Amendment 2). */
  sessionOpen: boolean
  /** Slice 16. Both optional: with `gmEnabled` false — the default
   * everywhere until `VITE_GM_ENABLED` is set — this component behaves
   * exactly as it did before the GM existed, and the Log path below is
   * untouched either way. */
  gmEnabled?: boolean
  onAskGm?: (input: string) => Promise<GmTurnResult>
  /** Only needed to read the day's remaining GM turns on mount. */
  campaignId?: string
  className?: string
}

/** Kind selector chips + text field + Log button (journal-mockup.html's
 * `.composer`). System isn't offered here — v1's system entries are
 * either auto-generated from ledger events (later slices) or
 * hand-created for imports, not something a player logs mid-session.
 *
 * Visual-reconciliation fix: this used to also carry a dice-trigger
 * button next to Log, added back when the party rail didn't exist yet
 * (see the git history's original comment on that button). Now that a
 * real rail with a real tools dock exists (player-view-mockup.html
 * v10's `.tooldock`), Roll lives there instead — this component goes
 * back to input + Log only, closing the "two ways to roll" duplication
 * the dice button next to Log had introduced.
 *
 * Slice 16 adds a second mode. The Log/Ask GM control is a segmented
 * toggle rather than a fifth kind chip on purpose: it changes what the
 * box *does*, not what kind of entry it produces. In GM mode the kind
 * chips are hidden, because choosing the kind becomes the GM's job. */
export function JournalComposer({
  onLog,
  sessionOpen,
  gmEnabled = false,
  onAskGm,
  campaignId,
  className,
}: JournalComposerProps) {
  const [kind, setKind] = useState<LogEntryKind>('action')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<Mode>('log')
  /** Phase 1 only. The GM has no tools yet, so it cannot write to the
   * journal itself — and rather than have the client write on its
   * behalf, the reply is shown here and forgotten. Deliberate: stub
   * output has no business being persisted into a real campaign's 144
   * entries. Phase 3 removes this when the GM calls `log_journal_entry`
   * directly and its narration arrives as normal entries. */
  const [reply, setReply] = useState<GmTurnResult | null>(null)
  const [budget, setBudget] = useState<GmBudget | null>(null)

  const gmAvailable = gmEnabled && Boolean(onAskGm)
  const gmMode = gmAvailable && mode === 'gm'

  // Read the day's budget once on mount so the counter is honest before
  // the first question rather than appearing only after a reply carries
  // it back. Costs one database read and no provider requests.
  useEffect(() => {
    if (!gmAvailable || !campaignId) return
    let cancelled = false
    void getGmBudget(campaignId).then((result) => {
      if (!cancelled && result) setBudget(result)
    })
    return () => {
      cancelled = true
    }
  }, [gmAvailable, campaignId])

  const remaining = budget ? Math.max(0, budget.limit - budget.used) : null
  const usedFraction = budget && budget.limit > 0 ? budget.used / budget.limit : 0
  const outOfBudget = reply?.status === 'budget_exhausted' || remaining === 0
  const disabled = !sessionOpen || submitting

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || disabled) return
    setSubmitting(true)
    try {
      if (gmMode && onAskGm) {
        const result = await onAskGm(trimmed)
        if (result.budget) setBudget(result.budget)
        // A reply that reached the journal needs no strip — it is already
        // in the feed above, and showing it twice reads as a duplicate.
        // Everything else (brakes, budget, errors, and the case where the
        // GM answered but the journal write failed) still surfaces here,
        // because none of those land anywhere the player would see them.
        setReply(result.status === 'ok' && result.logged ? null : result)
        // Only clear the box on a real answer — if a brake fired or the
        // budget ran out, the player hasn't had their turn yet and
        // shouldn't have to retype it.
        if (result.status === 'ok') setBody('')
        if (result.status === 'budget_exhausted' || result.status === 'disabled') setMode('log')
      } else {
        await onLog(kind, trimmed)
        setBody('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {gmAvailable && (
        <div className="flex items-center gap-3">
          <div
            className="inline-flex self-start rounded-full border border-line-soft bg-panel2 p-[3px]"
            role="radiogroup"
            aria-label="Composer mode"
          >
            {(['log', 'gm'] as Mode[]).map((value) => {
              const active = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={value === 'gm' && outOfBudget}
                  onClick={() => setMode(value)}
                  className={cx(
                    // Same compact-pill exception as the kind chips
                    // below — see their comment; `min-h-11` is
                    // deliberately not applied to this dense control.
                    'inline-flex items-center justify-center rounded-full px-3.5 py-1.5 uppercase',
                    text.caption,
                    active && value === 'log' && 'bg-purple text-white',
                    // Cyan, not purple: purple is already carrying the
                    // active kind chip and the Log button in this same
                    // region, and a second purple control there blurs
                    // which one is the thing you press.
                    active && value === 'gm' && 'bg-cyan text-[#04262b]',
                    !active && 'text-ink-faint hover:text-ink-dim',
                    value === 'gm' && outOfBudget && 'pointer-events-none opacity-35',
                  )}
                >
                  {value === 'log' ? 'Log' : 'Ask GM'}
                </button>
              )
            })}
          </div>
          {remaining !== null && (
            <div className="ml-auto flex items-center gap-2">
              {/* A bar as well as a number: the number answers "how many
                * have I got", the bar answers "should I be worried yet"
                * at a glance, mid-scene, without reading. */}
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
                  'tabular-nums',
                  usedFraction >= 1 ? 'text-red' : usedFraction >= 0.8 ? 'text-yellow' : undefined,
                )}
                title={`${budget?.used} of ${budget?.limit} requests used today. A simple turn costs one.`}
              >
                {remaining} left
              </span>
            </div>
          )}
        </div>
      )}

      {reply && <GmReply result={reply} onDismiss={() => setReply(null)} />}

      {!gmMode && (
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
      )}

      {gmMode && submitting && (
        <div className={cx(text.label, 'flex items-center gap-2 text-cyan')} aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1 w-1 animate-pulse rounded-full bg-cyan" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-cyan [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-cyan [animation-delay:300ms]" />
          </span>
          The GM is thinking
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <TextInput
            value={body}
            onChange={(event: { target: { value: string } }) => setBody(event.target.value)}
            onKeyDown={(event: { key: string }) => {
              if (event.key === 'Enter') void handleSubmit()
            }}
            placeholder={
              !sessionOpen
                ? 'Start a session to log entries'
                : gmMode
                  ? 'Tell the GM what you do…'
                  : 'Add to the journal…'
            }
            disabled={disabled}
            className="w-full"
            aria-label={gmMode ? 'Message to the GM' : 'Journal entry'}
          />
        </div>
        {/* Deliberately NOT recoloured cyan to match the mockup. Button
          * builds its own class string and appends `className` last,
          * but Tailwind resolves same-specificity utilities by CSS
          * source order, not attribute order — so `bg-cyan` overriding
          * `bg-purple` here would be luck, not design. The toggle above
          * carries the GM's cyan identity instead. If the cyan button is
          * wanted, the correct fix is a third `variant` on Button, which
          * is a style-guide change and its own decision. */}
        <Button onClick={() => void handleSubmit()} disabled={disabled || !body.trim()}>
          {gmMode ? 'Ask' : 'Log'}
        </Button>
      </div>
    </div>
  )
}
