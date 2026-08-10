import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface AiVoiceToggleProps {
  on: boolean
  onToggle: () => void
}

/**
 * Per-entry pill (2026-08-10, moved here after owner feedback on the
 * first pass — "it need to be a toggle pill right before the speaker
 * after each message"; this used to live as an icon button in the
 * journal header instead). `JournalFeed` renders one of these into
 * every narration `LogEntryRow`, immediately before that row's own
 * read-aloud button — see `LogEntryRow`'s `voiceToggle` slot — so the
 * choice is made right where it's acted on rather than in a header
 * control easy to miss.
 *
 * The choice itself is global and per-device (`useAiVoicePreference`),
 * NOT per-message: every row's pill reflects and controls the same one
 * preference, the same way every row's speak button already draws from
 * `lib/speech.ts`'s one shared playback singleton rather than each
 * having its own player.
 *
 * Pill, not icon-button: matches the ROLL/NOTE tag pill `LogEntryRow`
 * already renders in this exact row, rather than the 44px icon-button
 * shape the header's OTHER controls use — a dense, per-entry control
 * repeated down the whole feed calls for the same compact treatment
 * `LogEntryRow`'s own doc comment already argues for on the speak/
 * save-note buttons sitting right beside this one.
 */
export function AiVoiceToggle({ on, onToggle }: AiVoiceToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "GM voice: Fish Audio — click to use your browser's voice instead" : "GM voice: browser — click to use the GM's real voice"}
      className={cx(
        'shrink-0 whitespace-nowrap rounded-full border px-2 py-1 uppercase transition-colors',
        text.label,
        on
          ? 'border-purple/45 bg-purple/15 text-purple'
          : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
      )}
    >
      {on ? 'AI Voice' : 'Browser Voice'}
    </button>
  )
}
