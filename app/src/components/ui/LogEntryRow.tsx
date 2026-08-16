import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { browserSpeechAvailable, startSpeaking } from '../../lib/speech'
import type { SpeechHandle } from '../../lib/speech'
import { text } from '../../lib/typography'
import { Icon } from './Icon'
import { Markdown } from './Markdown'

export type LogEntryKind = 'narration' | 'action' | 'roll' | 'note' | 'system' | 'rules'

interface LogEntryRowProps {
  senderName: string
  /** Hex color for this sender (SPEC's "one PC color everywhere" rule).
   * Required, not defaulted — every real entry has an owner. Applied via
   * inline style rather than a Tailwind class: this is arbitrary
   * per-character data, not one of the six fixed palette tones, so
   * Tailwind can't generate a class for it at build time. Ignored only
   * for 'system' — the mockup renders that voice in a fixed muted tone
   * regardless of who's speaking. 'narration' USED to be muted the same
   * way; task 1 (BOB_queue) lifted that so AI GM narration can render in
   * its own cyan while a hand-typed narration entry with no real
   * actor_color still falls back to the same muted gray it always had
   * (JournalFeed's FALLBACK_COLOR is already close to ink-faint). */
  senderColor: string
  message: string
  timestamp?: string
  kind?: LogEntryKind
  /** "Save as note" quick action (2026-08-09) — a small control at the
   * far right of the header row that hands this entry's text back to
   * the caller (`JournalFeed`), which seeds the composer with it rather
   * than creating anything itself; this component stays a dumb renderer
   * and doesn't know what happens after the click. Omit to render no
   * button at all — `JournalFeed` already withholds it for entries
   * where it wouldn't make sense (a note saved from a note). */
  onSaveAsNote?: () => void
  /** Global voice preference (UI review slice A, 2026-08-16) — this
   * replaced the old per-row `voiceToggle` node slot: the choice moved
   * to ONE switch by the composer (`AiVoiceToggle`, now rendered by
   * `JournalComposer`), so rows no longer display or control it, they
   * just obey the result. `false` removes the read-aloud button from
   * this row entirely (owner's approved semantics: voice off means no
   * speaker buttons anywhere, not a fallback voice). Defaults to true
   * so read-only call sites that never wired voice at all keep their
   * old behavior. */
  voiceEnabled?: boolean
  className?: string
}

const tagLabel: Partial<Record<LogEntryKind, string>> = {
  roll: 'roll',
  note: 'note',
}

// Message-body width cap. `35ch` on mobile, `65ch` from `sm:` up — a
// deliberate "readable measure" choice (roughly the classic 45-75
// character line-length guideline) that was never revisited once the
// desktop three-column layout landed. Bug (2026-08-11, "chat entries
// hit an invisible wall before the actual border"): `sm:` is a 640px
// floor with no further step, so this same ~65-character cap was still
// being applied inside the `xl:` three-column journal layout's own
// narration/journal column, which is itself several hundred px wider
// than 65ch actually measures out to at this app's body text size —
// text was wrapping well short of the column's real right edge, with a
// visible dead gap between the wrap point and the border. `xl:` (the
// same breakpoint the three-column layout itself keys off) drops the
// cap entirely: below it, the single-column mobile/tablet view still
// gets the readable-measure treatment (its container is wide enough
// that an uncapped paragraph would genuinely overrun a comfortable
// reading width); at `xl:` and up, the surrounding column's own width
// already IS the appropriate measure for a chat/log context, so letting
// the paragraph fill it (Tailwind's max-width utilities are the only
// thing narrowing it — a block-level `<p>`/`<Markdown>` fills its
// parent by default) is correct rather than double-constraining it.
const messageWidthClass = 'max-w-[35ch] sm:max-w-[65ch] xl:max-w-none'

/** Scene log / party chat row — six entry kinds now (SPEC.md's original
 * five plus 'rules', added for BOB_queue task 1's unified feed;
 * journal-mockup.html in the repo root is the approved visual spec for
 * the original five): narration (GM voice, quiet panel card — color now
 * follows senderColor rather than being forced, see above), action (a
 * character speaks/acts — the plain default), roll (action plus a ROLL
 * tag; v1 rolls are hand-typed text, no dice engine yet), note (NOTE
 * tag, notes-to-future-self), system (receded style — auto-generated
 * from ledger events in later slices, manually creatable in v1 for
 * imports), rules (out-of-character gm_chat exchange merged into the
 * feed for display only — never a real journal_entries row — a quiet
 * orange-tinted card, same treatment on both the question and the
 * answer so an exchange reads as one digression at a glance; its body
 * renders through the markdown subset renderer, BOB_queue task 2 — the
 * rules assistant is asked to structure its answers, unlike narration,
 * which stays plain prose by design).
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
  onSaveAsNote,
  voiceEnabled = true,
  className,
}: LogEntryRowProps) {
  const muted = kind === 'system'
  const dotColor = muted ? 'var(--color-ink-faint)' : senderColor
  const nameColor = muted ? 'var(--color-ink-dim)' : senderColor
  const tag = tagLabel[kind]

  // Read-aloud (2026-08-09) — narration only (GM voice, whether AI- or
  // hand-typed; see senderColor's note above on the two sources sharing
  // this kind). All voice logic — the GM's real Gemini voice with the
  // browser voice as fallback, singleton playback, caching — lives in
  // `lib/speech.ts`; this component just asks for a `SpeechHandle` and
  // tracks whether it's the row currently talking. The button renders
  // whenever ANY tier could speak; on a browser with no speechSynthesis
  // at all the AI tier still works, so the old hard feature-gate on
  // speechSynthesis alone would hide a working button.
  const canSpeak = voiceEnabled && kind === 'narration' && (browserSpeechAvailable() || typeof window !== 'undefined')
  const [speaking, setSpeaking] = useState(false)
  /** True from click until audio actually starts — the AI voice takes
   * several seconds to synthesize, and with no visible change in that
   * window the button reads as broken ("you click and nothing
   * happens"). Drives a pulse on the icon. */
  const [loading, setLoading] = useState(false)
  const handleRef = useRef<SpeechHandle | null>(null)

  // Stops this row's own playback if it unmounts mid-read (e.g. the
  // player switches campaigns while narration is still playing).
  useEffect(() => {
    return () => {
      handleRef.current?.stop()
    }
  }, [])

  // Guards the stop-while-synthesizing race: clicking stop during the
  // AI tier's second-or-two synthesis wait bumps the generation, and
  // when the stale `startSpeaking` finally resolves it sees the bump
  // and kills its own playback instead of starting it.
  const genRef = useRef(0)

  async function handleSpeak() {
    if (speaking) {
      genRef.current++
      handleRef.current?.stop()
      handleRef.current = null
      setSpeaking(false)
      setLoading(false)
      return
    }
    // `startSpeaking` itself stops any other row's playback — the
    // singleton lives in lib/speech.ts, not here. The AI tier can take
    // a second or two to synthesize; flip the state immediately so the
    // button reads as "stop" (and can cancel) during that wait.
    const gen = ++genRef.current
    setSpeaking(true)
    setLoading(true)
    const handle = await startSpeaking(message)
    setLoading(false)
    if (genRef.current !== gen) {
      handle.stop()
      return
    }
    handleRef.current = handle
    void handle.done.then(() => {
      // Only clear if this row is still the active one — a second
      // click may already have replaced the handle.
      if (handleRef.current === handle) {
        handleRef.current = null
        setSpeaking(false)
      }
    })
  }

  return (
    <div
      className={cx(
        // `group` powers the quick actions' hover-reveal below.
        'group rounded-lg px-3 py-2',
        kind === 'narration' && 'border border-line-soft bg-panel',
        kind === 'rules' && 'border border-orange/25 bg-orange/[0.06]',
        kind === 'system' && 'opacity-[0.85]',
        className,
      )}
    >
      {/* Bug fix: the dot used to sit outside this row, offset by a
       * fixed `mt-1` guessed to optically center it against a plain
       * name line — which broke whenever a `tag` (the ROLL/NOTE pill,
       * a bordered box with its own padding) was present, since that
       * makes the first line taller only in that case, and a fixed
       * offset can't track a height that changes per-entry. Fixed by
       * putting the dot in its own `items-center` row with the name
       * line, so it centers against whatever that line actually
       * contains — pill or not — instead of guessing its height. */}
      <div className="flex items-center gap-4">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className={cx(text.caption, 'font-semibold')} style={{ color: nameColor }}>
            {senderName}
          </span>
          {timestamp && <span className={cx(text.caption, 'text-ink-faint')}>{timestamp}</span>}
          {tag && <span className={cx(text.label, 'rounded-full border border-line px-2 py-1')}>{tag}</span>}
        </div>
      </div>
      {/* `pl-6` (24px) re-creates the indent the old flex layout gave
       * the message for free (it used to share a column with the name
       * row) — 24px is the dot's 8px width plus the row's 16px gap
       * above, so the message text lines up under the name rather than
       * the dot. */}
      {kind === 'rules' ? (
        <Markdown text={message} className={cx(messageWidthClass, 'pl-6')} />
      ) : (
        // Paragraph breaks (UI review slice A, 2026-08-16 — "narration
        // needs to breathe"): a body with blank lines renders as real
        // paragraphs with spacing between them instead of one wall.
        // Split on 2+ newlines; `whitespace-pre-line` inside each
        // paragraph still honors single newlines as soft breaks. A body
        // with no blank lines produces exactly one <p>, so every
        // existing entry renders as before. Applies to every non-rules
        // kind, not just narration — a hand-typed multi-paragraph note
        // earns the same treatment for free.
        <div className={cx(messageWidthClass, 'flex flex-col gap-2.5 pl-6')}>
          {message.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0).map((paragraph, index) => (
            <p
              key={index}
              className={cx(
                kind === 'system' ? cx(text.caption, 'text-ink-faint') : text.bodySecondary,
                'whitespace-pre-line',
              )}
            >
              {paragraph.trim()}
            </p>
          ))}
        </div>
      )}
      {/* Quick actions: below the message (2026-08-09, owner feedback —
       * after the content they act on, not above it), revealed on
       * hover/tap rather than always-on (UI review slice A, 2026-08-16
       * — the feed's #1 noise finding was permanent per-entry chrome
       * repeated down the whole session). Opacity-only reveal in a row
       * whose space is always reserved (owner follow-up: "things don't
       * expand when you roll over — just the icons are shown"): the
       * first pass animated max-height, which shifted the entry's own
       * height on every hover; with the icons now `small` (16px, the
       * same follow-up) the reserved row is shallow enough to keep.
       * Touch devices reveal on tap for free (mobile browsers apply
       * :hover then); `group-has-[:focus-visible]:` keeps the buttons
       * reachable by keyboard, since they stay in the tab order while
       * invisible — deliberately NOT the broader `group-focus-within:`
       * of the first pass, which held the row lit after any mouse CLICK
       * on a button (browsers leave focus on a clicked button, so rows
       * you'd used stayed stuck on until you clicked elsewhere — owner:
       * "roll overs are getting stuck on"). `:focus-visible` only
       * matches keyboard-driven focus, which is the only case the
       * fallback exists for. `pointer-events-none` while hidden so the
       * invisible buttons can't swallow a stray click in the reserved
       * row. `pl-6` keeps them in the message's left indent. The
       * compact-control exception (no 44px targets in this dense
       * repeated row) carries over unchanged. */}
      {(canSpeak || onSaveAsNote) && (
        <div
          className={cx(
            'flex items-center gap-1 pl-6 pt-0.5 transition-opacity duration-150',
            // Stays revealed while this row is talking (or warming up) —
            // otherwise the stop control would vanish the moment the
            // pointer wanders off mid-narration.
            // Hover-reveal is DESKTOP-ONLY (`xl:`, the same breakpoint
            // the journal's layouts split on): a touch screen has no
            // hover, so below xl: the actions are simply always visible
            // (owner, 2026-08-16: "we are missing the voice stuff on
            // mobile — roll over will not work"). The icons are `small`
            // now, so the permanent mobile row costs little quiet.
            speaking || loading
              ? 'opacity-100'
              : 'xl:pointer-events-none xl:opacity-0 xl:group-hover:pointer-events-auto xl:group-hover:opacity-100 xl:group-has-[:focus-visible]:pointer-events-auto xl:group-has-[:focus-visible]:opacity-100',
          )}
        >
          {canSpeak && (
            <button
              type="button"
              onClick={handleSpeak}
              aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
              title={loading ? 'The GM is clearing his throat…' : speaking ? 'Stop reading aloud' : 'Read aloud'}
              className={cx(
                'shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink',
                loading && 'animate-pulse text-cyan',
              )}
            >
              <Icon name="speak" small state={speaking ? 'active' : 'default'} />
            </button>
          )}
          {onSaveAsNote && (
            <button
              type="button"
              onClick={onSaveAsNote}
              aria-label="Save as note"
              title="Save as note"
              className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <Icon name="saveNote" small />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
