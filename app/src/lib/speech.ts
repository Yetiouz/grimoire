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

  const handle = speakWithBrowser(text)
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

/** Downloaded high-quality system voices — the real prize. */
const QUALITY_PATTERNS: RegExp[] = [/premium/i, /enhanced/i, /natural/i, /neural/i]
/** Chrome's own remote voices — on desktop Chrome these sound far
 * better than the compact local system voices it exposes (the original
 * scoring preferred local voices and reliably picked a robotic one). */
const REMOTE_GOOD = /google (us|uk) english/i
/** Decent-but-compact named voices across macOS/iOS and Edge — better
 * than nothing, worse than everything above. */
const NAMED_DECENT = /\b(samantha|ava|zoe|allison|nathan|evan|tom)\b/i

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
  // Tiered, mutually exclusive quality bands — a Premium/Enhanced
  // system voice always beats Google's remote voices, which always
  // beat merely-decent compact names. `localService` is deliberately
  // not a signal in any band: in Chrome the compact local set is the
  // robotic one.
  if (QUALITY_PATTERNS.some((pattern) => pattern.test(voice.name))) score += 6
  else if (REMOTE_GOOD.test(voice.name)) score += 5
  else if (NAMED_DECENT.test(voice.name)) score += 3
  // The user's own OS-level voice choice comes through as `default`.
  // +5 outranks the named-decent band and the en-US bonus combined —
  // necessary because Safari lists system voices WITHOUT the
  // "(Premium)"/"(Enhanced)" suffix Chrome shows, so a premium system
  // default can look like a plain-named voice to the quality patterns
  // and lose to a compact "Samantha" (observed live: Safari playing
  // the wrong voice while Chrome picked correctly). A junk default
  // still loses to a recognizably premium voice: 5+2 < 6+2.
  if (voice.default) score += 5
  return score
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
}

/** True when tier 2 exists at all — rows use this to decide whether the
 * speaker button renders when the AI tier isn't configured. */
export function browserSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Warm the voice list the moment this module loads, not at first click.
// Chrome delivers voices asynchronously, and a click that lands before
// they arrive used to speak through Chrome's fallback voice (observed
// live as "some novelty voice" — Albert). By first-click time this has
// long since resolved. No-op on browsers with synchronous voice lists.
if (browserSpeechAvailable()) {
  setTimeout(() => void loadVoices(), 0)
}

/** Safari GC guard: Safari garbage-collects a SpeechSynthesisUtterance
 * that nothing references and cuts the speech off mid-sentence when it
 * does. A module-level reference to the active utterance is the
 * documented workaround. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only by design: existing is the point
let keepAlive: SpeechSynthesisUtterance | null = null

/** Deliberately SYNCHRONOUS, no awaits before `speak()` — Safari only
 * allows speech started inside the user's click; the old version's
 * voice-list wait (up to 500ms) pushed `speak()` outside that window
 * and Safari silently dropped it ("Chrome works, Safari does not").
 * The cost: the very first click of a session, if the voice list isn't
 * loaded yet, speaks with the browser default and warms the cache; the
 * next click gets the premium voice. Every browser that loads voices
 * synchronously (Safari itself does) never hits that case at all. */
function speakWithBrowser(text: string): SpeechHandle {
  if (!browserSpeechAvailable()) {
    return { source: 'browser', stop: () => {}, done: Promise.resolve() }
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  let stopped = false
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  utterance.onend = () => settle()
  utterance.onerror = () => settle()

  const speakNow = () => {
    keepAlive = utterance
    synth.speak(utterance)
    // Safari sometimes leaves the engine in a paused state from a
    // prior cancel; resume() is a no-op everywhere it isn't needed.
    synth.resume()
  }

  const voices = (cachedVoices && cachedVoices.length > 0) ? cachedVoices : synth.getVoices()
  if (voices.length > 0) {
    // The normal path — synchronous, inside the click gesture, which is
    // what Safari requires. Safari's voice list is itself synchronous,
    // so Safari always lands here.
    cachedVoices = voices
    const voice = pickVoice(voices)
    if (voice) utterance.voice = voice
    speakNow()
  } else {
    // Cold start on an async-list browser (Chrome, pre-warm racing the
    // click). Chrome does NOT require in-gesture speech, so waiting for
    // the real list and speaking with the right voice beats speaking
    // instantly with the novelty fallback.
    void loadVoices().then((loaded) => {
      if (stopped) {
        settle()
        return
      }
      const voice = pickVoice(loaded)
      if (voice) utterance.voice = voice
      speakNow()
    })
  }

  return {
    source: 'browser',
    done,
    stop: () => {
      stopped = true
      synth.cancel()
      settle()
    },
  }
}
