/**
 * Read-aloud for narration entries (`LogEntryRow`'s speaker button),
 * two tiers:
 *
 * 1. **The GM's real voice** — Gemini TTS through the `gm_turn` edge
 *    function (mode `speak`), when the GM feature is on. Natural
 *    narrator audio with a standing grimdark delivery instruction;
 *    costs one request from the same daily budget as GM turns.
 * 2. **The browser's own voice** — the original SpeechSynthesis path,
 *    kept whole as the fallback for every way tier 1 can be
 *    unavailable: GM off, budget spent, network down, provider swapped
 *    to one without TTS. Free, offline, and admittedly more toaster
 *    than narrator — which is exactly why it's the fallback and not
 *    the feature.
 *
 * The screen wires tier 1 up via `configureAiSpeech` (it knows the
 * campaign id and the flag; this module doesn't) and rows just call
 * `startSpeaking`. Playback is a singleton: starting any read stops
 * whatever else was playing, from either tier.
 */
import { askGmSpeak } from './gm'

// ── tier-1 wiring ────────────────────────────────────────────────────

let aiCampaignId: string | null = null

/** Called by the journal screen on mount (and with `null` on unmount).
 * Without it, `startSpeaking` goes straight to the browser voice. */
export function configureAiSpeech(campaignId: string | null) {
  aiCampaignId = campaignId
}

/** In-memory audio cache, keyed by the exact text. Re-reading the same
 * entry is the single most likely repeat action, and without this each
 * repeat costs a real budget request for byte-identical audio. Session
 * lifetime only; modest cap so a long session doesn't hoard blobs. */
const audioCache = new Map<string, string>()
const AUDIO_CACHE_MAX = 20

export interface SpeechHandle {
  /** Stops playback now. Safe to call more than once. */
  stop: () => void
  /** Resolves when playback ends for any reason (finished, stopped,
   * errored). Never rejects. */
  done: Promise<void>
  /** Which tier actually spoke — surfaced so the button could hint it
   * some day; nothing depends on it today. */
  source: 'ai' | 'browser'
}

let current: SpeechHandle | null = null

/** One shared <audio> element for all AI playback, primed inside the
 * click gesture. iOS Safari refuses `audio.play()` that happens several
 * seconds after the tap (which is exactly when synthesis finishes), but
 * it allows later plays on an element that already played *something*
 * during a real user gesture — so `startSpeaking`'s synchronous prefix
 * plays a 44-byte silent WAV on this element before the first await,
 * and the real narration reuses the unlocked element afterwards.
 * Without this the phone experience is a button that does nothing. */
let player: HTMLAudioElement | null = null
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

function primePlayer() {
  if (!player) player = new Audio()
  player.src = SILENT_WAV
  void player.play().catch(() => {
    /* a rejected silent play is fine — priming is best-effort */
  })
}

/** Speaks `text`, preferring the GM's real voice, falling back to the
 * browser's. Stops any other playback first. Never rejects.
 *
 * MUST be called directly from a user-gesture handler (a click) — the
 * synchronous prefix below is what unlocks mobile audio; wrapping this
 * in a setTimeout or awaiting something first breaks phones. */
export async function startSpeaking(text: string): Promise<SpeechHandle> {
  current?.stop()

  if (aiCampaignId) {
    // Synchronous, inside the gesture — see `primePlayer`.
    primePlayer()
    const cached = audioCache.get(text)
    const url = cached ?? (await fetchAiAudio(aiCampaignId, text))
    if (url) {
      const handle = playUrl(url)
      current = handle
      return handle
    }
    // Fall through: budget spent, TTS error, offline — the browser
    // voice is the answer to all of them.
  }

  const handle = await speakWithBrowser(text)
  current = handle
  return handle
}

async function fetchAiAudio(campaignId: string, text: string): Promise<string | null> {
  const result = await askGmSpeak(campaignId, text)
  if (result.status !== 'ok' || !result.audio) return null
  const bytes = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
  audioCache.set(text, url)
  if (audioCache.size > AUDIO_CACHE_MAX) {
    const [oldest] = audioCache.keys()
    const stale = audioCache.get(oldest)
    audioCache.delete(oldest)
    if (stale) URL.revokeObjectURL(stale)
  }
  return url
}

function playUrl(url: string): SpeechHandle {
  // Reuses the gesture-primed singleton, NOT a fresh Audio element — a
  // fresh one has no gesture attached and iOS would refuse it.
  const audio = player ?? (player = new Audio())
  audio.src = url
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  audio.onended = () => settle()
  audio.onerror = () => settle()
  void audio.play().catch(() => settle())
  return {
    source: 'ai',
    done,
    stop: () => {
      audio.pause()
      settle()
    },
  }
}

// ── tier 2: the browser voice (the original picker, scoring fixed) ──

const PREFERRED_NAME_PATTERNS: RegExp[] = [
  /premium/i,
  /enhanced/i,
  /natural/i,
  /neural/i,
  // Chrome's own remote voices — on desktop Chrome these sound far
  // better than the compact local system voices the browser exposes,
  // which is why they get their own entry here (the original scoring
  // preferred local voices and reliably picked a robotic one).
  /google (us|uk) english/i,
  // Common higher-quality named voices across macOS/iOS and Edge.
  /\b(samantha|ava|zoe|allison|nathan|evan|tom)\b/i,
]

let cachedVoices: SpeechSynthesisVoice[] | null = null

/** Resolves once the browser has a real voice list. Chrome loads voices
 * asynchronously — `getVoices()` returns `[]` on the very first call in
 * a page's lifetime — so this waits for the `voiceschanged` event, with
 * a short timeout fallback for browsers that never fire it. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  // `.length` guard, not just truthiness: an EMPTY array must never be
  // cached. The original version cached whatever the 500ms timeout saw
  // — and on the first click of a session that was often still [],
  // which then stuck forever and sent every single read to the
  // browser's default robot voice even on a machine with premium
  // voices installed. (The observed "it defaults to the bad voice"
  // bug, verified live: the scorer itself picks Ava (Premium) fine
  // once it's actually given the list.)
  if (cachedVoices && cachedVoices.length > 0) return Promise.resolve(cachedVoices)
  const synth = window.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) {
    cachedVoices = existing
    return Promise.resolve(existing)
  }
  return new Promise((resolve) => {
    const finish = () => {
      const voices = synth.getVoices()
      // Cache only a real list; an empty one stays uncached so the
      // next click retries instead of inheriting this one's bad luck.
      if (voices.length > 0) cachedVoices = voices
      resolve(voices)
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
  // Scoring fix (the "toaster voice" bug): a named quality match now
  // outranks everything, and `localService` is no longer a positive
  // signal — in Chrome the best-sounding voices are Google's remote
  // ones, and the local voices it exposes are the compact robotic set.
  if (PREFERRED_NAME_PATTERNS.some((pattern) => pattern.test(voice.name))) score += 5
  return score
}

async function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices()
  if (voices.length === 0) return null
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
}

/** True when tier 2 exists at all — rows use this to decide whether the
 * speaker button renders when the AI tier isn't configured. */
export function browserSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

async function speakWithBrowser(text: string): Promise<SpeechHandle> {
  if (!browserSpeechAvailable()) {
    return { source: 'browser', stop: () => {}, done: Promise.resolve() }
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  const voice = await pickVoice()
  if (voice) utterance.voice = voice
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  utterance.onend = () => settle()
  utterance.onerror = () => settle()
  window.speechSynthesis.speak(utterance)
  return {
    source: 'browser',
    done,
    stop: () => {
      window.speechSynthesis.cancel()
      settle()
    },
  }
}
