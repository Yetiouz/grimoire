/**
 * Thin wrapper around the browser's SpeechSynthesis API for narration
 * read-aloud (`LogEntryRow`'s speaker button). Exists mainly to fix the
 * actual complaint about it — not the API itself, but that an
 * unconfigured `new SpeechSynthesisUtterance(text)` speaks through
 * whichever voice the browser happens to call "default," which on
 * Chrome is often a flat, robotic one even on a machine (macOS, iOS,
 * Windows) that ships several much more natural-sounding voices
 * alongside it. Picking a real voice explicitly, plus a very slight
 * rate tweak, is what actually fixes it — there's no separate "quality"
 * knob to turn.
 */

const PREFERRED_NAME_PATTERNS: RegExp[] = [
  /premium/i,
  /enhanced/i,
  /natural/i,
  /neural/i,
  // Common higher-quality named voices across macOS/iOS, Chrome, and
  // Edge — matched loosely since the exact list differs by OS version
  // and browser, and there's no standard "quality" field to read
  // instead.
  /\b(samantha|ava|zoe|allison|nathan|evan|tom)\b/i,
]

let cachedVoices: SpeechSynthesisVoice[] | null = null

/** Resolves once the browser has a real voice list. Chrome loads voices
 * asynchronously — `getVoices()` returns `[]` on the very first call in
 * a page's lifetime — so this waits for the `voiceschanged` event, with
 * a short timeout fallback for browsers that never fire it (older
 * Safari). Cached after the first successful load: the list doesn't
 * change mid-session, and re-querying it on every click would replay
 * this same wait each time. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices)
  const synth = window.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) {
    cachedVoices = existing
    return Promise.resolve(existing)
  }
  return new Promise((resolve) => {
    const finish = () => {
      cachedVoices = synth.getVoices()
      resolve(cachedVoices)
    }
    synth.addEventListener('voiceschanged', finish, { once: true })
    setTimeout(finish, 500)
  })
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0
  const lang = voice.lang?.toLowerCase() ?? ''
  if (lang.startsWith('en')) score += 1
  if (lang === 'en-us') score += 1
  // A local (on-device) voice is the one actually worth preferring here
  // — it's what "enhanced"/"premium" system voices are, and it also
  // means no network round-trip per utterance. Not a synonym for
  // quality in general, just a reasonable tiebreaker among English
  // voices.
  if (voice.localService) score += 1
  if (PREFERRED_NAME_PATTERNS.some((pattern) => pattern.test(voice.name))) score += 3
  return score
}

async function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices()
  if (voices.length === 0) return null
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
}

/** Speaks `text` using the best available voice and returns the
 * `SpeechSynthesisUtterance` so the caller can attach its own
 * `onend`/`onerror` (`LogEntryRow` uses these to reset its button
 * state). Rate is nudged down slightly from the engines' flat 1.0
 * default — narration reads more naturally a touch slower. Callers are
 * responsible for calling `window.speechSynthesis.cancel()` first if
 * something else might already be speaking; this function only starts
 * a new utterance, it doesn't stop an old one. */
export async function speakText(text: string): Promise<SpeechSynthesisUtterance> {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  const voice = await pickVoice()
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
  return utterance
}
