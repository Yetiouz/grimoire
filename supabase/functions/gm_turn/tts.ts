// tts.ts — the GM's actual voice (mode "speak").
//
// Turns a narration entry's text into audio via Fish Audio's TTS API
// (2026-08-10, owner's call after trying it live: "dark story is fire").
// Was Gemini's native TTS before this — left disabled behind
// VITE_GM_TTS (see JournalScreen.tsx's own comment) because its free
// tier throttled hard enough that most reads just timed out. Fish
// Audio's free `s2.1-pro-free` model has no hard character cap (fair-use
// policy instead of a quota), so this tier can actually be turned on now
// — flipping VITE_GM_TTS=true in Vercel is the one remaining step, done
// separately from a deploy, not from here.
//
// This is a separate call path from provider.ts on purpose: provider.ts
// speaks OpenAI-compatible chat completions (swappable to Groq/Claude by
// env), while this is a single-provider TTS call with no OpenAI-
// compatible equivalent. `FISH_API_KEY` is its own secret, independent
// of `MODEL_API_KEY` — swapping the text-generation provider was never
// meant to also swap who reads it aloud, and now that they're genuinely
// different providers (Fish Audio vs. whatever's behind MODEL_BASE_URL)
// that independence actually matters.
//
// Same invariants as everything else in this function: no state
// survives a request, and every failure is a structured return, never a
// throw that could wedge a client.

const TTS_BASE = Deno.env.get("FISH_TTS_BASE") ?? "https://api.fish.audio/v1/tts";
/** `s2.1-pro-free` per Fish Audio's free-tier API announcement — same
 * underlying model as their paid tiers, just rate-limited by fair use
 * instead of a hard quota. Swappable by secret (e.g. to a paid tier)
 * with no redeploy: FISH_TTS_MODEL. */
const TTS_MODEL = Deno.env.get("FISH_TTS_MODEL") ?? "s2.1-pro-free";
/** Voice model id. Swapped 2026-08-18 (owner's pick from Fish Audio's
 * text-to-speech picker — https://fish.audio/app/text-to-speech/?modelId=
 * a5971a1fd805441aaf3b0bbe8c9f1ab6) off "Dark Story"
 * (2832d3fa41e246589ffa41187dafa9b1, the prior default, tried live and
 * approved back on 2026-08-10 — "dark story is fire"). Swappable by
 * secret, no redeploy: FISH_TTS_REFERENCE_ID. */
const TTS_REFERENCE_ID = Deno.env.get("FISH_TTS_REFERENCE_ID") ?? "a5971a1fd805441aaf3b0bbe8c9f1ab6";
/** Fish Audio takes a numeric prosody knob, not a natural-language style
 * instruction the way Gemini's generateContent did — there's no
 * equivalent of the old "read slowly, in a low, unhurried, ominous
 * voice" prompt prefix here. Slightly under 1x is the closest available
 * analog for "slowly, unhurried" delivery at a candlelit table.
 * Swappable by secret: FISH_TTS_SPEED. */
const TTS_SPEED = Number(Deno.env.get("FISH_TTS_SPEED") ?? "0.92");

/** Keeps one read-aloud from eating the fair-use budget or the 20s
 * client-side timeout (see index.ts's GM_TTS_TIMEOUT_MS) — GM
 * narrations run well under this; anything longer is truncated at a
 * sentence-ish boundary rather than refused. */
const MAX_TTS_CHARS = Number(Deno.env.get("GM_TTS_MAX_CHARS") ?? "4000");

export interface TtsResult {
  /** Base64 WAV — requested directly in that format (`format: "wav"`
   * below) rather than Gemini's old raw-PCM-plus-server-side-RIFF-header
   * dance, since Fish Audio can just hand back a real WAV file. Keeps
   * the client contract (`lib/speech.ts`'s `fetchAiAudio`, which builds
   * a `Blob([...], { type: 'audio/wav' })`) unchanged across the
   * provider swap — nothing downstream of this file needed to move. */
  audio: string | null;
  error: string | null;
}

export async function synthesize(text: string, signal: AbortSignal): Promise<TtsResult> {
  const key = Deno.env.get("FISH_API_KEY");
  if (!key) return { audio: null, error: "no FISH_API_KEY" };

  let clipped = text;
  if (clipped.length > MAX_TTS_CHARS) {
    const cut = clipped.slice(0, MAX_TTS_CHARS);
    clipped = cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, MAX_TTS_CHARS - 200));
  }

  const res = await fetch(TTS_BASE, {
    method: "POST",
    signal,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      // Header, not a body field — same "model" header Fish Audio's own
      // API expects to pick between e.g. s2.1-pro and s2.1-pro-free.
      "model": TTS_MODEL,
    },
    body: JSON.stringify({
      text: clipped,
      reference_id: TTS_REFERENCE_ID,
      format: "wav",
      prosody: { speed: TTS_SPEED },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { audio: null, error: `tts ${res.status}: ${detail}` };
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) {
    return { audio: null, error: "tts: empty response body" };
  }

  return { audio: bytesToBase64(bytes), error: null };
}

/** Chunked btoa — spreading a multi-megabyte array into one
 * String.fromCharCode call overflows the argument limit. Same helper
 * the old Gemini path used for its own WAV bytes, kept as-is since the
 * problem it solves (encoding a large binary response) is unchanged by
 * which provider produced the bytes. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
