import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
  /** AI-voice on/off pill (2026-08-10, `AiVoiceToggle.tsx`), rendered
   * immediately before this row's own read-aloud button when given —
   * "host owns the action, header owns the layout" split, same
   * convention `JournalHeader`'s `sessionAction`/`gmBudget` slots use,
   * just at row scope instead of page scope. This component builds
   * nothing itself and doesn't know the preference is global/per-device
   * rather than per-row — `JournalFeed` decides that and hands back a
   * ready node, same as it already does for `onSaveAsNote`'s button.
   * Omit to render no pill at all (unavailable in this build, or this
   * row can't speak anyway — see `canSpeak` below, which already gates
   * whether this ever shows regardless of what's passed here). */
  voiceToggle?: ReactNode
  className?: string
}

const tagLabel: Partial<Record<LogEntryKind, string>> = {
  roll: 'roll',
  note: 'note',
}

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
  voiceToggle,
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
  const canSpeak = kind === 'narration' && (browserSpeechAvailable() || typeof window !== 'undefined')
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
        'rounded-lg px-3 py-2',
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
        <Markdown text={message} className="max-w-[35ch] pl-6 sm:max-w-[65ch]" />
      ) : (
        <p
          className={cx(
            kind === 'system' ? cx(text.caption, 'text-ink-faint') : text.bodySecondary,
            'max-w-[35ch] pl-6 sm:max-w-[65ch]',
          )}
        >
          {message}
        </p>
      )}
      {/* Quick actions moved below the message (2026-08-09, owner
       * feedback) — they used to sit in the header row, level with the
       * name/timestamp, but that put them above content they act on
       * (read this message, save this message) rather than after it.
       * `pl-6` keeps them in the same left indent as the message text
       * above. Compact-control exception, same call as the composer's
       * mode pill and the header filter chips — this sits in a dense
       * per-entry row repeated many times down the feed, so a full
       * 44px touch target on every single one would add real bulk. A
       * small ghost icon button, matching `GmReply`'s dismiss "×" in
       * spirit (a low-emphasis inline utility control, not a primary
       * action). Flagged rather than assumed settled — worth
       * revisiting if it proves fiddly to tap on a phone. */}
      {(canSpeak || onSaveAsNote) && (
        <div className="flex items-center gap-1 pl-6 pt-1">
          {canSpeak && voiceToggle}
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
              <Icon name="speak" state={speaking ? 'active' : 'default'} />
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
              <Icon name="saveNote" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
