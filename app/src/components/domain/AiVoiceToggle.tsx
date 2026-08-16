import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface AiVoiceToggleProps {
  on: boolean
  onToggle: () => void
}

/**
 * ONE global voice switch (UI review slice A, 2026-08-16) — this
 * replaced the per-entry pill this file used to export. The pill put
 * the same global choice on every narration row ("BROWSER VOICE"
 * repeated dozens of times down a session was the review's #1 noise
 * finding), and the owner picked the mockup's alternative: a single
 * slider by the composer. Same one shared preference underneath
 * (`useAiVoicePreference` — global, per-device), new semantics on OFF:
 * the read-aloud feature disappears entirely (no speaker buttons on
 * any row — see `LogEntryRow`'s `voiceEnabled` gate) rather than
 * falling back to the browser voice. On, playback uses the best tier
 * available exactly as before: the GM's real voice where the build has
 * it, the browser voice otherwise (`lib/speech.ts` owns that tiering).
 *
 * Rendered by `JournalComposer` (the one place the player already
 * looks to interact with the GM), not by the feed — the feed no longer
 * knows the preference is toggleable at all, it just receives the
 * resulting on/off.
 *
 * `role="switch"` rather than a pressed-button: this is a settings
 * toggle with a visible thumb, and switch is the ARIA pattern that
 * announces "on/off" rather than "pressed".
 */
export function AiVoiceToggle({ on, onToggle }: AiVoiceToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      title={on ? 'Voice on — narration can be read aloud' : 'Voice off — no read-aloud anywhere'}
      className="flex shrink-0 cursor-pointer items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-block h-5 w-[38px] rounded-full border transition-colors',
          on ? 'border-cyan/50 bg-cyan/[0.18]' : 'border-line bg-panel2',
        )}
      >
        <span
          className={cx(
            'absolute top-[2px] block h-3.5 w-3.5 rounded-full transition-all',
            on ? 'left-[19px] bg-cyan' : 'left-[2px] bg-ink-faint',
          )}
        />
      </span>
      <span className={cx(text.label, 'uppercase', on ? 'text-cyan' : 'text-ink-faint')}>Voice</span>
    </button>
  )
}
