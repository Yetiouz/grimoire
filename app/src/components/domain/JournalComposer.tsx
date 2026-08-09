import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Button } from '../ui/Button'
import type { LogEntryKind } from '../ui/LogEntryRow'
import { getGmBudget } from '../../lib/gm'
import { GmReply } from './GmReply'
import type { GmBudget, GmTurnResult } from '../../lib/gm'

/** One selection answers one question: what is this message? The four
 * journal kinds and the two Ask modes are a single radio row (owner:
 * "they should all be inline… you are asking rules, you are putting in
 * a log, you are talking to a gm") — the old two-step (mode toggle,
 * THEN kind chips) asked that same question in two controls that looked
 * identical. Each choice owns a color; the selected chip lights as a
 * soft tint (owner picked variant B of composer-inline-mockup.html),
 * and the send button + input border follow the selection.
 *
 * Hexes duplicate index.css's @theme tokens because the button/border
 * treatments need inline styles: Button composes its own bg classes and
 * appends className last, but Tailwind resolves same-specificity
 * utilities by stylesheet order, so class-based overrides there are
 * luck — inline style is the one mechanism that wins by specification.
 * Chip tints stay class-based (full literal strings, statically
 * scannable). Cyan and orange are fixed identities (GM / Rules,
 * matching the feed); the four kind colors are the owner-approved
 * mockup assignment.
 */
type Choice = LogEntryKind | 'gm' | 'rules'

interface ChoiceSpec {
  id: Choice
  label: string
  ai: boolean
  hex: string
  /** Selected-state chip classes — variant B's soft tint. */
  on: string
  placeholder: string
}

const CHOICES: ChoiceSpec[] = [
  { id: 'action', label: 'Action', ai: false, hex: '#9b5cff', on: 'border-purple/45 bg-purple/15 text-purple', placeholder: 'Add to the journal…' },
  { id: 'narration', label: 'Narration', ai: false, hex: '#ff3fd6', on: 'border-pink/45 bg-pink/15 text-pink', placeholder: 'Narrate the scene…' },
  { id: 'roll', label: 'Roll', ai: false, hex: '#39ff8f', on: 'border-green/45 bg-green/15 text-green', placeholder: 'Record a roll…' },
  { id: 'note', label: 'Note', ai: false, hex: '#ffd23f', on: 'border-yellow/45 bg-yellow/15 text-yellow', placeholder: 'Jot a note…' },
  { id: 'gm', label: 'Ask GM', ai: true, hex: '#35f0ff', on: 'border-cyan/45 bg-cyan/15 text-cyan', placeholder: 'Tell the GM what you do…' },
  { id: 'rules', label: 'Ask Rules', ai: true, hex: '#ff8a3d', on: 'border-orange/45 bg-orange/15 text-orange', placeholder: 'Ask a rules question…' },
]

interface JournalComposerProps {
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Gates the whole composer per the approved plan: no entry can be
   * logged before a session is explicitly started (Amendment 2). */
  sessionOpen: boolean
  /** Slice 16. With `gmEnabled` false — the default until
   * `VITE_GM_ENABLED` is set — the Ask chips never render and the row
   * is just the four kinds. */
  gmEnabled?: boolean
  onAskGm?: (input: string) => Promise<GmTurnResult>
  /** Out-of-character lookups: never reach the journal, stored in
   * gm_chat and read back from Tools -> Rules. */
  onAskRules?: (input: string) => Promise<GmTurnResult>
  /** Only needed to read the day's remaining GM turns on mount. */
  campaignId?: string
  className?: string
}

export function JournalComposer({
  onLog,
  sessionOpen,
  gmEnabled = false,
  onAskGm,
  onAskRules,
  campaignId,
  className,
}: JournalComposerProps) {
  const [choice, setChoice] = useState<Choice>('action')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reply, setReply] = useState<GmTurnResult | null>(null)
  const [budget, setBudget] = useState<GmBudget | null>(null)

  const gmAvailable = gmEnabled && Boolean(onAskGm)
  const selected = CHOICES.find((c) => c.id === choice) ?? CHOICES[0]
  const aiMode = gmAvailable && selected.ai
  const rulesMode = aiMode && choice === 'rules' && Boolean(onAskRules)

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
      if (aiMode) {
        const ask = rulesMode ? onAskRules! : onAskGm!
        const result = await ask(trimmed)
        if (result.budget) setBudget(result.budget)
        // A reply that reached the journal needs no strip — it is already
        // in the feed above. Everything else (brakes, budget, errors, a
        // failed journal write) still surfaces here.
        setReply(result.status === 'ok' && result.logged ? null : result)
        // Only clear the box on a real answer — if a brake fired or the
        // budget ran out, the player hasn't had their turn yet and
        // shouldn't have to retype it.
        if (result.status === 'ok') setBody('')
        if (result.status === 'budget_exhausted' || result.status === 'disabled') setChoice('action')
      } else {
        await onLog(choice as LogEntryKind, trimmed)
        setBody('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const visibleChoices = gmAvailable ? CHOICES : CHOICES.filter((c) => !c.ai)

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="What is this message?">
        {visibleChoices.map((c) => {
          const isOn = choice === c.id
          const askLocked = c.ai && outOfBudget
          return (
            <span key={c.id} className="flex items-center gap-1.5">
              {/* Thin divider between "goes in the journal" and "asks the
                * AI" — the one distinction worth keeping from the old
                * two-row layout, at one-pixel cost. */}
              {c.id === 'gm' && <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />}
              <button
                type="button"
                role="radio"
                aria-checked={isOn}
                disabled={!sessionOpen || askLocked}
                onClick={() => setChoice(c.id)}
                className={cx(
                  // Compact-pill exception to the 44px touch-target rule —
                  // decided by the owner for this dense chip-row shape;
                  // same precedent as the header filter chips.
                  'inline-flex items-center justify-center rounded-full border px-3 py-1 uppercase',
                  text.caption,
                  isOn ? c.on : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
                  !sessionOpen && 'pointer-events-none opacity-40',
                  askLocked && 'pointer-events-none opacity-35',
                )}
              >
                {c.label}
              </button>
            </span>
          )
        })}
        {gmAvailable && remaining !== null && (
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

      {reply && <GmReply result={reply} onDismiss={() => setReply(null)} />}

      {aiMode && submitting && (
        <div className={cx(text.label, 'flex items-center gap-2')} style={{ color: selected.hex }} aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1 w-1 animate-pulse rounded-full" style={{ background: selected.hex }} />
            <span className="h-1 w-1 animate-pulse rounded-full [animation-delay:150ms]" style={{ background: selected.hex }} />
            <span className="h-1 w-1 animate-pulse rounded-full [animation-delay:300ms]" style={{ background: selected.hex }} />
          </span>
          {rulesMode ? 'Checking the rules' : 'The GM is thinking'}
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
            placeholder={!sessionOpen ? 'Start a session to log entries' : selected.placeholder}
            disabled={disabled}
            className="w-full"
            // Follows the selected color (mockup B). Inline style, not a
            // class: it must beat `border-line` AND `focus:border-purple`
            // in TextInput regardless of stylesheet order.
            style={{ borderColor: `${selected.hex}66` }}
            aria-label={choice === 'gm' ? 'Message to the GM' : choice === 'rules' ? 'Rules question' : 'Journal entry'}
          />
        </div>
        <Button
          onClick={() => void handleSubmit()}
          disabled={disabled || !body.trim()}
          // The send button wears the selection's color (mockup B, all six
          // choices — dark label for contrast on every hue). Inline for
          // the same stylesheet-order reason as the input border; the
          // shadow is recomputed so a green Roll button doesn't glow
          // purple.
          style={{
            background: selected.hex,
            color: '#0a0a0c',
            boxShadow: `0 0 0 1px ${selected.hex}40, 0 8px 24px -8px ${selected.hex}8c`,
          }}
        >
          {aiMode ? 'Ask' : 'Log'}
        </Button>
      </div>
    </div>
  )
}
