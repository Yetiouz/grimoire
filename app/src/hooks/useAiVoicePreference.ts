import { useState } from 'react'

/** localStorage key for the player's own choice of whether the GM's
 * real voice (Fish Audio, via `gm_turn`'s `speak` mode) should be used,
 * as opposed to always falling back to the browser's built-in voice.
 * Deliberately a device-level preference, not a campaign one — no
 * campaignId in the key — matching the reasoning already in
 * JournalScreen's own TTS comment ("the system voices on his own
 * devices sound as good"): this is about the listener's hardware and
 * taste, not the story being told, so it should follow the browser,
 * not the campaign. */
const STORAGE_KEY = 'grimoire:ai-voice-enabled'

/** Defaults to on. Now that `VITE_GM_TTS` is actually flipped on for a
 * build (2026-08-10), the intent is for the GM's real voice to be what
 * plays unless a player opts out — not an opt-in buried behind a
 * control nobody finds on their first session. */
const DEFAULT_ENABLED = true

function readStored(): boolean {
  if (typeof window === 'undefined') return DEFAULT_ENABLED
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_ENABLED
    return raw === 'true'
  } catch {
    // Private browsing / storage disabled — fall back rather than
    // throw; this preference is a nicety, never a hard dependency for
    // anything else in the app to function.
    return DEFAULT_ENABLED
  }
}

/** The player's on/off choice for the GM's AI voice, persisted across
 * sessions on this device. Independent of whether the tier is actually
 * *available* right now (`VITE_GM_TTS` the build flag, `gmEnabled` the
 * feature flag) — JournalScreen ANDs the two together itself before
 * calling `configureAiSpeech`, so this hook only ever needs to track
 * the player's preference, never the build's capability. */
export function useAiVoicePreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(readStored)

  function set(next: boolean) {
    setEnabled(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Best-effort persistence only — see readStored's own comment.
      // The in-memory state above still updates, so the toggle works
      // for the rest of this session even when storage is unavailable.
    }
  }

  return [enabled, set]
}
