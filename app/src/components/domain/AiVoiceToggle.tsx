import { cx } from '../../lib/cx'
import { Icon } from '../ui/Icon'

interface AiVoiceToggleProps {
  on: boolean
  onToggle: () => void
}

/**
 * Journal header control (2026-08-10): lets a player switch the GM's
 * read-aloud between its two tiers without touching Vercel — Fish
 * Audio's real narrator voice when on, the browser's built-in voice
 * when off. `lib/speech.ts`'s `startSpeaking` already falls back to the
 * browser tier for every OTHER way the AI tier can be unavailable
 * (budget spent, network down, no audio returned); this is just one
 * more path into that same fallback, driven by the player's own choice
 * via `configureAiSpeech(null)` rather than a failure.
 *
 * JournalScreen only renders this at all when the AI tier actually
 * exists in this build (`VITE_GM_TTS` + `gmEnabled` both true) — with
 * either off, there's nothing to switch between and the browser voice
 * is simply always what plays, same as before this control existed.
 * The choice itself persists per-device via `useAiVoicePreference`, not
 * per-campaign.
 *
 * Same pill-button shape as the header's other icon-only controls
 * (the top bar's disabled menu button) — h-11 w-11, rounded-button,
 * border — sized to match rather than inventing a new control style
 * for one button. Active state borrows SessionAction's tint pattern
 * (color/45 border, color/10 bg) rather than a solid fill, per the
 * style guide's "color lives in accents" rule.
 */
export function AiVoiceToggle({ on, onToggle }: AiVoiceToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "GM voice: Fish Audio — click to use your browser's voice instead" : "GM voice: browser — click to use the GM's real voice"}
      aria-label={on ? "Turn off the GM's AI voice" : "Turn on the GM's AI voice"}
      className={cx(
        'inline-flex h-11 w-11 items-center justify-center rounded-button border',
        'transition-[background-color,border-color,opacity] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        on ? 'border-purple/45 bg-purple/10' : 'border-line bg-panel',
      )}
    >
      <Icon name={on ? 'speak' : 'voiceOff'} state={on ? 'active' : 'default'} label={on ? 'AI voice on' : 'AI voice off'} />
    </button>
  )
}
