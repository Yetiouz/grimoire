import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { GmTurnResult, PendingGmTurn } from '../../lib/gm'
import { AiVoiceToggle } from './AiVoiceToggle'
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
  /** Recognition mark (UI review slice B, 2026-08-16 — playtest
   * feedback: a first-time player reads every text label before she
   * can pick; an icon lets her recognize instead). Rendered `small`
   * inside the chip, inheriting the chip's own color via
   * `currentColor` so it lights with the selection tint for free. */
  icon: IconName
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
  { id: 'action', icon: 'chat', label: 'Action', short: 'Act', ai: false, hex: '#9b5cff', on: 'border-purple/45 bg-purple/15 text-purple', placeholder: 'Add to the journal…' },
  { id: 'narration', icon: 'journal', label: 'Narration', short: 'Nar', ai: false, hex: '#ff3fd6', on: 'border-pink/45 bg-pink/15 text-pink', placeholder: 'Narrate the scene…' },
  { id: 'roll', icon: 'dice', label: 'Roll', short: 'Roll', ai: false, hex: '#39ff8f', on: 'border-green/45 bg-green/15 text-green', placeholder: 'Record a roll…' },
  { id: 'note', icon: 'saveNote', label: 'Note', short: 'Note', ai: false, hex: '#ffd23f', on: 'border-yellow/45 bg-yellow/15 text-yellow', placeholder: 'Jot a note…' },
]

/** AI-GM campaigns. `id: 'action'` still backs "Party" (it logs the
 * same `LogEntryKind`, just no longer offered next to a manual
 * "Narration" option) — nothing downstream of `onLog`/the feed needed
 * to change for the rename. */
const AI_GM_CHOICES: ChoiceSpec[] = [
  { id: 'action', icon: 'party', label: 'Party', short: 'Party', ai: false, hex: '#9b5cff', on: 'border-purple/45 bg-purple/15 text-purple', placeholder: 'Say or do something…' },
  { id: 'gm', icon: 'gm', label: 'GM', short: 'GM', ai: true, hex: '#35f0ff', on: 'border-cyan/45 bg-cyan/15 text-cyan', placeholder: 'Tell the GM what you do…' },
  { id: 'note', icon: 'saveNote', label: 'Notes', short: 'Notes', ai: false, hex: '#ffd23f', on: 'border-yellow/45 bg-yellow/15 text-yellow', placeholder: 'Jot a note…' },
  { id: 'rules', icon: 'rules', label: 'Rules', short: 'Rules', ai: true, hex: '#ff8a3d', on: 'border-orange/45 bg-orange/15 text-orange', placeholder: 'Ask a rules question…' },
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
  /** The optional `signal` param (2026-08-18) lets this composer's own
   * Stop button abort an in-flight turn — see `handleSubmit`'s
   * `AbortController` and `askGm`'s own doc comment on what a stop
   * does and doesn't guarantee. Both callers just forward it straight
   * to `askGm`. */
  onAskGm?: (input: string, signal?: AbortSignal) => Promise<GmTurnResult>
  /** Out-of-character lookups: never reach the journal, stored in
   * gm_chat and read back from Tools -> Rules. */
  onAskRules?: (input: string, signal?: AbortSignal) => Promise<GmTurnResult>
  /** Reports this composer's in-flight/settled AI turn up to the host
   * layout (2026-08-18) so `JournalFeed` can render it — see
   * `PendingGmTurn`'s own doc comment for the full "why lifted" story.
   * Called with a 'thinking' turn the moment an Ask submits, with
   * `null` the moment a reply lands in the journal (the real entry is
   * the resting mark then), or with a 'settled' turn for every other
   * outcome (stopped, a brake, budget_exhausted, an error, or an
   * unfiled ok reply). Omit for a composer with no feed to report to. */
  onPendingTurnChange?: (pending: PendingGmTurn | null) => void
  /** Only needed to read the day's remaining GM turns on mount. */
  campaignId?: string
  /** Whether the voice tier exists in this build (`VITE_GM_TTS`), same
   * flag `JournalScreen` computes as `ttsAvailable`. Gates the second
   * (Voice) budget bar below, same as it gates the header's own copy —
   * see `GmBudgetBar`'s doc comment for why the meter moved here
   * (2026-08-10, owner: "stack those where we have this 134 left"). */
  ttsAvailable?: boolean
  /** The ONE global voice switch (UI review slice A, 2026-08-16) —
   * `AiVoiceToggle` moved here from every narration row (see that
   * component's doc comment for the history). Rendered in the top row's
   * right-hand cluster, next to the budget meters, whenever both are
   * given; both omitted together where the host has no voice to offer.
   * The composer just displays and reports — `JournalScreen` owns the
   * preference (`useAiVoicePreference`) and feeds the resulting on/off
   * to the feed separately. */
  aiVoiceOn?: boolean
  onToggleAiVoice?: () => void
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
  onPendingTurnChange,
  campaignId,
  ttsAvailable = false,
  aiVoiceOn,
  onToggleAiVoice,
  seed,
  className,
}: JournalComposerProps) {
  const [choice, setChoice] = useState<Choice>('action')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bodyInputRef = useRef<HTMLInputElement>(null)
  // The in-flight ask's own AbortController (2026-08-18) — created fresh
  // in `handleSubmit` for every aiMode turn, cleared in its `finally`.
  // `handleStop` reads it to abort whatever turn is currently running;
  // null between turns (and for non-AI Log submissions, which never set
  // it at all) so a stray Stop click has nothing to do.
  const abortControllerRef = useRef<AbortController | null>(null)
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
  // Immediate lock the instant a turn comes back budget_exhausted — this
  // composer used to read that off the local `reply` state it kept for
  // the strip it rendered; now that the strip (and the state) lives with
  // `pendingTurn` up in the host layout (2026-08-18), this one-field
  // mirror is all `outOfBudget` actually needs, rather than reaching
  // back up for the lifted state. `refetchBudget` above will bring
  // `remaining` to 0 too, just not synchronously in this same render.
  const [budgetJustExhausted, setBudgetJustExhausted] = useState(false)
  const outOfBudget = budgetJustExhausted || remaining === 0
  const disabled = !sessionOpen || submitting

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || disabled) return
    setSubmitting(true)
    try {
      if (aiMode) {
        const ask = rulesMode ? onAskRules! : onAskGm!
        const turnMode = rulesMode ? 'rules' : 'gm'
        // Reported up before the await, not after — this is the signal
        // `JournalFeed` animates on (2026-08-18, see `PendingGmTurn`'s
        // own doc comment for why this moved out of this component
        // entirely rather than just relocating the JSX).
        onPendingTurnChange?.({ mode: turnMode, phase: 'thinking' })
        // A fresh controller per turn (2026-08-18) — `handleStop` below
        // aborts whichever one is current; cleared in `finally` so a
        // Stop click after the turn has already settled has nothing
        // stale to abort.
        const controller = new AbortController()
        abortControllerRef.current = controller
        const result = await ask(trimmed, controller.signal)
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
        setBudgetJustExhausted(result.status === 'budget_exhausted')
        // A reply that reached the journal needs no resting mark — the
        // real entry is already in the feed. Everything else (brakes,
        // budget, errors, a failed journal write) settles in place
        // instead, right where the thinking row was.
        onPendingTurnChange?.(
          result.status === 'ok' && result.logged ? null : { mode: turnMode, phase: 'settled', result },
        )
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
      abortControllerRef.current = null
    }
  }

  // The composer's own half of the Stop control (2026-08-18) —
  // `abortControllerRef` is only ever set while an aiMode turn is in
  // flight (see `handleSubmit`), so this is a no-op if there's nothing
  // to stop. Aborting resolves `askGm`'s promise with `status:
  // 'stopped'` (see that function's own doc comment on what a stop
  // does and doesn't guarantee) — `handleSubmit`'s `finally` still runs
  // normally from there, same as any other outcome.
  function handleStop() {
    abortControllerRef.current?.abort()
  }

  // Accessible name for the icon-only submit button below — same text
  // the button used to render before the 2026-08-11 icon swap ("change
  // log send buttons to a send icon"). Kept as a variable since both
  // `aria-label` and `title` want the exact same string.
  const submitLabel = aiMode ? 'Send' : 'Log'
  // True while the button should read as Stop instead of Send/Log
  // (2026-08-18) — only for an in-flight AI turn; a plain Log submit is
  // a fast local write with nothing worth offering to cancel.
  const stopping = aiMode && submitting

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
                {/* `currentColor` (inline, so it beats `stateColorClass`
                  * regardless of stylesheet order) makes the mark follow
                  * the chip's own text color — tinted when selected, dim
                  * at rest — with no per-choice color plumbing.
                  *
                  * Below xl:, only the SELECTED chip spells its label —
                  * the rest are icon-only (owner, 2026-08-16: the icons
                  * pushed Rules off the edge of a phone screen behind
                  * the voice switch — "the tabs on the send button you
                  * can't see"). Same recognize-don't-read treatment the
                  * world rail's mobile tabs use; color + icon + position
                  * carry the identity, and the row fits again. */}
                <Icon name={c.icon} small style={{ color: 'currentColor' }} className={cx(isOn ? 'mr-1.5' : 'xl:mr-1.5')} />
                <span className={cx('xl:hidden', !isOn && 'hidden')}>{c.short}</span>
                <span className="hidden xl:inline">{c.label}</span>
              </button>
            </span>
          )
        })}
        </div>
        {/* Right-hand cluster: the global voice switch (slice A — see
          * `AiVoiceToggle`'s doc comment), then the budget meters.
          * `ml-auto` on the cluster, not the meters, so the switch rides
          * along pinned right whether or not the meters render. */}
        {(Boolean(onToggleAiVoice) || (meterRelevant && budget && budgetByMode)) && (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {aiVoiceOn !== undefined && onToggleAiVoice && <AiVoiceToggle on={aiVoiceOn} onToggle={onToggleAiVoice} />}
            {meterRelevant && budget && budgetByMode && (
              // Stacked, not side-by-side (2026-08-10, owner: "stack
              // those where we have this 134 left") — this replaced the
              // composer's original single bar-plus-"N left" meter,
              // which only ever covered GM text turns. Each bar is
              // `GmBudgetBar`, the same component the header uses, so
              // the two locations read identically: percentage against
              // the one shared daily pool, split by mode. GM only
              // renders when Ask GM/Ask Rules exist here at all; Voice
              // only when the build's voice tier is on. The Voice bar
              // deliberately does NOT follow the player's own switch
              // (owner, slice A follow-up: "voice used bar needs to
              // stay") — it reports spend from the shared daily pool,
              // which is real information whether or not this player is
              // currently listening.
              <div className="flex shrink-0 flex-col items-end gap-1">
                {gmAvailable && <GmBudgetBar label="GM" used={budgetByMode.textUsed} limit={budget.limit} />}
                {ttsAvailable && <GmBudgetBar label="Voice" used={budgetByMode.voiceUsed} limit={budget.limit} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* The thinking row (and the settled reply strip that used to
        * live here as `GmReply`) moved into `JournalFeed` (2026-08-18,
        * owner: "the animation needs to go outside the box, in the chat
        * feed itself... when it's stopped it acts like an indicator of
        * where we are") — see `onPendingTurnChange` above and
        * `GmTurnIndicator` for what renders there now. This composer no
        * longer shows either one next to the input; `stopping` below
        * (still local — it only decides the send button's own icon) is
        * the last thing here that still cares whether a turn is in
        * flight. */}

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
        {/* The send control (slice A follow-up, 2026-08-16 — owner: "I
          * like the send button in the mockup better"): the shared
          * `Button` (a wide px-6 pill) is swapped for the mockup's
          * compact 52px block — same `rounded-button` radius, arrow
          * glyph — hand-rolled here rather than a new Button variant
          * since no other call site wants this shape. It still wears
          * the selection's color (mockup B); inline styles for the same
          * stylesheet-order reason as the input border, shadow
          * recomputed per selection so a green Roll button doesn't glow
          * purple. While the AI works (`aiMode && submitting`) the
          * arrow becomes a real Stop control
          * (2026-08-18, owner: "the button switches to a stop button" —
          * see `handleStop`/`stopping` above and the visible thinking
          * row above this for where the old hidden text went).
          * Deliberately re-ENABLED in that state — the button is a live
          * control again, not an inert one, and stays lit (no
          * `disabled:opacity-40`) for the same "the state IS the
          * feedback" reason the old pulsing version did. */}
        <button
          type="button"
          onClick={() => (stopping ? handleStop() : void handleSubmit())}
          disabled={stopping ? false : disabled || !body.trim()}
          aria-label={stopping ? (rulesMode ? 'Stop checking the rules' : 'Stop the GM') : submitLabel}
          title={stopping ? 'Stop' : submitLabel}
          className={cx(
            'flex w-[52px] shrink-0 items-center justify-center self-stretch rounded-button transition-opacity duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            !stopping && 'disabled:opacity-40',
          )}
          style={{
            background: selected.hex,
            color: '#0a0a0c',
            boxShadow: `0 0 0 1px ${selected.hex}40, 0 8px 24px -8px ${selected.hex}8c`,
          }}
        >
          {stopping ? (
            <Icon name="stop" small style={{ color: '#0a0a0c' }} />
          ) : (
            <span aria-hidden="true" className="text-base leading-none">➤</span>
          )}
        </button>
      </div>
    </div>
  )
}
