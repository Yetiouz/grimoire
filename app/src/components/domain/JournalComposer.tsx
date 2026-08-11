import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { GmTurnResult } from '../../lib/gm'
import { GmReply } from './GmReply'
import { GmBudgetBar } from './GmBudgetBar'
import { useGmBudget } from '../../hooks/useGmBudget'
import { useGmBudgetByMode } from '../../hooks/useGmBudgetByMode'

/** One selection answers one question: what is this message? Originally
 * one flat six-choice row (owner: "they should all be inline… you are
 * asking rules, you are putting in a log, you are talking to a gm")
 * replacing an even older two-step (mode toggle, THEN kind chips) that
 * asked the same question through two controls that looked identical.
 * Each choice owns a color; the selected chip lights as a soft tint
 * (owner picked variant B of composer-inline-mockup.html), and the send
 * button + input border follow the selection.
 *
 * Split into two four-choice rows (2026-08-10, owner's redesign): once
 * an AI GM exists, asking it already produces the narration — a
 * standalone "Narration" chip sitting next to "GM" looked like two ways
 * to do the same thing, when really it only ever earned its keep for
 * solo/human-GM campaigns, where nobody else is narrating for you and
 * `AI_GM_CHOICES` below never even renders (`onAskGm`/`onAskRules` are
 * only wired when the campaign has a real AI GM). "Roll" also dropped
 * from the AI-GM row: `ToolsDock`'s dice button already opens the real
 * roller and logs its own result, so a second inline way to log a roll
 * was redundant with that, not with anything else in this row.
 * `NON_AI_CHOICES` is untouched — unaffected by any of this, since
 * `visibleChoices` below only reaches for it when there's no AI GM to
 * ask in the first place.
 *
 * Hexes duplicate index.css's @theme tokens because the button/border
 * treatments need inline styles: Button composes its own bg classes and
 * appends className last, but Tailwind resolves same-specificity
 * utilities by stylesheet order, so class-based overrides there are
 * luck — inline style is the one mechanism that wins by specification.
 * Chip tints stay class-based (full literal strings, statically
 * scannable). Cyan and orange are fixed identities (GM / Rules,
 * matching the feed) in both rows; purple/yellow (Party/Notes) carry
 * over their prior Action/Note identities rather than picking new ones.
 */
type Choice = LogEntryKind | 'gm' | 'rules'

interface ChoiceSpec {
  id: Choice
  label: string
  /** Mobile label (below xl:) — owner's pick for keeping every choice
   * on one line on a phone: abbreviate rather than scroll, stack, or
   * hide behind a picker. Color + position carry the rest of the
   * meaning at that size. Equal to `label` on both rows now that
   * neither has more than four choices — "Party"/"GM"/"Notes"/"Rules"
   * and "Action"/"Roll"/"Note" are already short; only "Narration"
   * still needs the shorter "Nar". */
  short: string
  ai: boolean
  hex: string
  /** Selected-state chip classes — variant B's soft tint. */
  on: string
  placeholder: string
}

/** Solo and human-GM campaigns — `onAskGm` is never wired for either
 * (see `JournalScreen`'s `aiGmActive` gate), so this row's shape is
 * unchanged from the original single-row design: whoever is at the
 * keyboard is playing every part, including the GM's own narration. */
const NON_AI_CHOICES: ChoiceSpec[] = [
  { id: 'action', label: 'Action', short: 'Act', ai: false, hex: '#9b5cff', on: 'border-purple/45 bg-purple/15 text-purple', placeholder: 'Add to the journal…' },
  { id: 'narration', label: 'Narration', short: 'Nar', ai: false, hex: '#ff3fd6', on: 'border-pink/45 bg-pink/15 text-pink', placeholder: 'Narrate the scene…' },
  { id: 'roll', label: 'Roll', short: 'Roll', ai: false, hex: '#39ff8f', on: 'border-green/45 bg-green/15 text-green', placeholder: 'Record a roll…' },
  { id: 'note', label: 'Note', short: 'Note', ai: false, hex: '#ffd23f', on: 'border-yellow/45 bg-yellow/15 text-yellow', placeholder: 'Jot a note…' },
]

/** AI-GM campaigns. `id: 'action'` still backs "Party" (it logs the
 * same `LogEntryKind`, just no longer offered next to a manual
 * "Narration" option) — nothing downstream of `onLog`/the feed needed
 * to change for the rename. */
const AI_GM_CHOICES: ChoiceSpec[] = [
  { id: 'action', label: 'Party', short: 'Party', ai: false, hex: '#9b5cff', on: 'border-purple/45 bg-purple/15 text-purple', placeholder: 'Say or do something…' },
  { id: 'gm', label: 'GM', short: 'GM', ai: true, hex: '#35f0ff', on: 'border-cyan/45 bg-cyan/15 text-cyan', placeholder: 'Tell the GM what you do…' },
  { id: 'note', label: 'Notes', short: 'Notes', ai: false, hex: '#ffd23f', on: 'border-yellow/45 bg-yellow/15 text-yellow', placeholder: 'Jot a note…' },
  { id: 'rules', label: 'Rules', short: 'Rules', ai: true, hex: '#ff8a3d', on: 'border-orange/45 bg-orange/15 text-orange', placeholder: 'Ask a rules question…' },
]

interface JournalComposerProps {
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  /** Gates the whole composer per the approved plan: no entry can be
   * logged before a session is explicitly started (Amendment 2). Named
   * `sessionOpen` for history, but callers now pass `sessionActive`
   * (false while paused, not just while there's no open session at
   * all) — see `JournalDesktopLayout`'s doc comment on that prop. */
  sessionOpen: boolean
  /** Whether the open session is paused (2026-08-10) — purely for
   * placeholder copy here, distinguishing "no session yet" from
   * "session's paused" while `sessionOpen` is false either way. */
  sessionPaused?: boolean
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
  /** Whether the voice tier exists in this build (`VITE_GM_TTS`), same
   * flag `JournalScreen` computes as `ttsAvailable`. Gates the second
   * (Voice) budget bar below, same as it gates the header's own copy —
   * see `GmBudgetBar`'s doc comment for why the meter moved here
   * (2026-08-10, owner: "stack those where we have this 134 left"). */
  ttsAvailable?: boolean
  /** "Save as note" quick action (2026-08-09): the host layout hands
   * back a new object here each time the player taps the action on a
   * journal entry. Seeding, not submitting — this switches the
   * composer to Note mode and prefills the field so the player can
   * edit/trim before sending it, exactly as if they'd typed it
   * themselves. Compared by object identity (see the effect below), not
   * by `body` text, so re-tapping the same entry re-seeds/refocuses
   * rather than being ignored as an unchanged value. */
  seed?: { body: string } | null
  className?: string
}

export function JournalComposer({
  onLog,
  sessionOpen,
  sessionPaused = false,
  gmEnabled = false,
  onAskGm,
  onAskRules,
  campaignId,
  ttsAvailable = false,
  seed,
  className,
}: JournalComposerProps) {
  const [choice, setChoice] = useState<Choice>('action')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reply, setReply] = useState<GmTurnResult | null>(null)
  const bodyInputRef = useRef<HTMLInputElement>(null)
  // Tracks the last seed object this composer has already consumed, so
  // the effect below fires once per distinct "save as note" tap (new
  // object from the host layout) rather than on every re-render, and so
  // it can still tell "the same entry tapped again" (a new object, same
  // text) apart from "nothing changed."
  const consumedSeedRef = useRef<{ body: string } | null>(null)

  // "Save as note": switch to Note mode, prefill, and focus — never
  // auto-submit. Runs whenever the host hands back a seed object this
  // composer hasn't already consumed.
  useEffect(() => {
    if (!seed || seed === consumedSeedRef.current) return
    consumedSeedRef.current = seed
    setChoice('note')
    setBody(seed.body)
    bodyInputRef.current?.focus()
  }, [seed])

  const gmAvailable = gmEnabled && Boolean(onAskGm)
  // Which four-choice row is showing — see the two arrays' own doc
  // comments for why there are two rows instead of one filtered set.
  const visibleChoices = gmAvailable ? AI_GM_CHOICES : NON_AI_CHOICES
  const selected = visibleChoices.find((c) => c.id === choice) ?? visibleChoices[0]
  const aiMode = gmAvailable && selected.ai
  const rulesMode = aiMode && choice === 'rules' && Boolean(onAskRules)

  // Meter is relevant whenever either AI exists here: Ask GM/Ask Rules
  // spend the shared pool through this composer, and voice reads spend
  // it through LogEntryRow elsewhere on the page but are still worth
  // showing here since this is now the one place both bars live
  // (2026-08-10). Matches `JournalScreen`'s own `aiGmActive ||
  // ttsAvailable` gate for the same reasoning.
  const meterRelevant = gmAvailable || ttsAvailable

  // Folded onto the shared budget hooks (2026-08-10 cleanup) rather than
  // this component's own inline mount-fetch — see `useGmBudget`'s doc
  // comment for what that gains (the bar now also picks up a voice
  // spend from elsewhere on the page via the hook's own poll, not just
  // this composer's own Asks). `campaignId ?? ''` is safe: `enabled`
  // gates every read the hook does, so an empty id is never actually
  // fetched with — same "enabled owns the gate" contract `useJournalFeed`
  // already uses elsewhere.
  const budgetEnabled = meterRelevant && Boolean(campaignId)
  const { budget, remaining, refetch: refetchBudget } = useGmBudget(campaignId ?? '', budgetEnabled)
  const { byMode: budgetByMode, refetch: refetchBudgetByMode } = useGmBudgetByMode(campaignId ?? '', budgetEnabled)
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
        // The edge function's reply carries a fresh combined figure
        // (`result.budget`) as a side effect of the turn it just ran,
        // but the hook owns that state now (2026-08-10 fold-in) — rather
        // than reach in and set it directly, force the same out-of-cycle
        // read `refetch` was built for. One extra cheap DB read (same
        // "no provider spend" reasoning `useGmBudget` documents) for the
        // simplicity of one state owner instead of two. The mode split
        // was already always a separate re-fetch (the edge function has
        // no reason to know about it), so `refetchBudgetByMode` here is
        // no new cost, just the same call routed through the hook.
        void refetchBudget()
        void refetchBudgetByMode()
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

  // Accessible name for the icon-only submit button below — same text
  // the button used to render before the 2026-08-11 icon swap ("change
  // log send buttons to a send icon"). Kept as a variable since both
  // `aria-label` and `title` want the exact same string.
  const submitLabel = aiMode ? 'Send' : 'Log'

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        {/* One line, always (owner: no two-line wrap on mobile). The chip
          * strip scrolls horizontally where it doesn't fit — scrollbar
          * hidden, chips `shrink-0` so they never compress — while the
          * budget meter sits OUTSIDE the scroller, pinned at the right
          * and always visible regardless of scroll position. On desktop
          * the strip fits and this renders identically to a plain row. */}
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="What is this message?"
        >
        {visibleChoices.map((c) => {
          const isOn = choice === c.id
          const askLocked = c.ai && outOfBudget
          return (
            <span key={c.id} className="flex shrink-0 items-center gap-1.5">
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
                  // px-2 below xl:, where the compact labels keep all four
                  // chips + the bar on one 390px line with no scroll.
                  'inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2 py-1 uppercase xl:px-3',
                  text.caption,
                  isOn ? c.on : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
                  !sessionOpen && 'pointer-events-none opacity-40',
                  askLocked && 'pointer-events-none opacity-35',
                )}
              >
                <span className="xl:hidden">{c.short}</span>
                <span className="hidden xl:inline">{c.label}</span>
              </button>
            </span>
          )
        })}
        </div>
        {meterRelevant && budget && budgetByMode && (
          // Stacked, not side-by-side (2026-08-10, owner: "stack those
          // where we have this 134 left") — this replaced the composer's
          // original single bar-plus-"N left" meter, which only ever
          // covered GM text turns. Each bar is `GmBudgetBar`, the same
          // component the header uses, so the two locations read
          // identically: percentage against the one shared daily pool,
          // split by mode. GM only renders when Ask GM/Ask Rules exist
          // here at all; Voice only when the build's voice tier is on —
          // same two gates the header's own pair uses.
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {gmAvailable && <GmBudgetBar label="GM" used={budgetByMode.textUsed} limit={budget.limit} />}
            {ttsAvailable && <GmBudgetBar label="Voice" used={budgetByMode.voiceUsed} limit={budget.limit} />}
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
            ref={bodyInputRef}
            value={body}
            onChange={(event: { target: { value: string } }) => setBody(event.target.value)}
            onKeyDown={(event: { key: string }) => {
              if (event.key === 'Enter') void handleSubmit()
            }}
            placeholder={!sessionOpen ? (sessionPaused ? 'Session paused — resume to log entries' : 'Start a session to log entries') : selected.placeholder}
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
          aria-label={submitLabel}
          title={submitLabel}
          // The send button wears the selection's color (mockup B, every
          // choice in both rows — dark label for contrast on every hue).
          // Inline for the same stylesheet-order reason as the input
          // border; the shadow is recomputed per selection so, e.g., a
          // green Roll button (still in `NON_AI_CHOICES`) doesn't glow
          // purple.
          style={{
            background: selected.hex,
            color: '#0a0a0c',
            boxShadow: `0 0 0 1px ${selected.hex}40, 0 8px 24px -8px ${selected.hex}8c`,
          }}
        >
          {/* Icon swap (2026-08-11, "change log send buttons to a send
            * icon") — this used to render the word "Send" (aiMode: GM/
            * Rules) or "Log" (Party/Notes/every NON_AI_CHOICES entry) as
            * plain text. A single paper-plane glyph now covers both,
            * since "submit this" reads the same regardless of which of
            * the two words it used to be — the distinction those words
            * carried (asking the AI vs. writing straight to the journal)
            * is still fully conveyed by the chip row above and the
            * button's own color, not lost by dropping the label here.
            * `style` (not `state`) sets the icon's color: it must match
            * the button's own hardcoded `#0a0a0c` contrast color exactly,
            * which none of `Icon`'s three closed `IconState` tones are —
            * see the `style` prop's doc comment on `Icon.tsx` for why an
            * inline-style escape hatch was added rather than stretching
            * `IconState` to cover a runtime, per-selection color.
            * `aria-label`/`title` moved to the `Button` itself above
            * (this icon stays `aria-hidden`, no `label` prop) — same
            * "accessible name lives on the outer control, not the glyph"
            * pattern `LogEntryRow`'s speak/saveNote icon buttons already
            * use. */}
          <Icon name="send" style={{ color: '#0a0a0c' }} />
        </Button>
      </div>
    </div>
  )
}
