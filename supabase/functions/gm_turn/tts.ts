// tts.ts — the GM's actual voice (mode "speak").
//
// Turns a narration entry's text into audio through Gemini's native TTS
// endpoint, using the same MODEL_API_KEY the text turns use. This is a
// separate call path from provider.ts on purpose: provider.ts speaks
// OpenAI-compatible chat completions (swappable to Groq/Claude by env),
// while TTS is a Gemini-native generateContent capability with no
// OpenAI-compatible equivalent — pointing MODEL_BASE_URL at a different
// provider changes who writes the GM's words but not who reads them
// aloud. If the key stops being a Gemini key, synth fails cleanly and
// the client falls back to the browser voice.
//
// Same invariants as everything else in this function: no state
// survives a request, and every failure is a structured return, never a
// throw that could wedge a client.

const TTS_BASE = Deno.env.get("GM_TTS_BASE") ??
  "https://generativelanguage.googleapis.com/v1beta";
const TTS_MODEL = Deno.env.get("GM_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
/** Prebuilt voice. Algenib is the one Google describes as "gravelly" —
 * the closest stock fit for a grimdark table. Swappable by secret, no
 * redeploy: GM_TTS_VOICE. */
const TTS_VOICE = Deno.env.get("GM_TTS_VOICE") ?? "Algenib";
/** Delivery direction. TTS models take plain-language style
 * instructions ahead of the text; this is the standing one. Also a
 * secret override (GM_TTS_STYLE) so voice-direction iteration is a
 * dashboard edit, not a deploy — same philosophy as system_packs. */
const TTS_STYLE = Deno.env.get("GM_TTS_STYLE") ??
  "Read the following tabletop RPG narration slowly, in a low, unhurried, " +
  "ominous voice — a grim fantasy game master at a candlelit table. " +
  "Read the text exactly as written; do not add, skip or change any words:";

/** Keeps one read-aloud from eating the daily quota or the 30s clamp —
 * GM narrations run well under this; anything longer is truncated at a
 * sentence-ish boundary rather than refused. */
const MAX_TTS_CHARS = Number(Deno.env.get("GM_TTS_MAX_CHARS") ?? "4000");

export interface TtsResult {
  /** Base64 WAV (16-bit PCM mono, 24kHz — Gemini's raw PCM wrapped in a
   * RIFF header server-side so the client can hand it straight to an
   * <audio> element without knowing the sample format). */
  audio: string | null;
  error: string | null;
}

export async function synthesize(text: string, signal: AbortSignal): Promise<TtsResult> {
  const key = Deno.env.get("MODEL_API_KEY");
  if (!key) return { audio: null, error: "no MODEL_API_KEY" };

  let clipped = text;
  if (clipped.length > MAX_TTS_CHARS) {
    const cut = clipped.slice(0, MAX_TTS_CHARS);
    clipped = cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, MAX_TTS_CHARS - 200));
  }

  const res = await fetch(`${TTS_BASE}/models/${TTS_MODEL}:generateContent`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      // Header, not ?key= — keys don't belong in URLs (they end up in
      // logs on every hop that sees the request line).
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${TTS_STYLE}\n\n${clipped}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { audio: null, error: `tts ${res.status}: ${detail}` };
  }

  const body = await res.json();
  const part = body?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data,
  );
  const pcmB64: string | undefined = part?.inlineData?.data;
  const mime: string = part?.inlineData?.mimeType ?? "audio/L16;rate=24000";
  if (!pcmB64) {
    return { audio: null, error: `tts: no audio in response (${JSON.stringify(body).slice(0, 200)})` };
  }

  // Gemini returns headerless PCM. Parse the rate out of the mime when
  // present rather than assuming 24000 stays true forever.
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? "24000");
  return { audio: pcmToWavBase64(pcmB64, rate), error: null };
}

/** Wraps raw 16-bit mono PCM in a minimal RIFF/WAV header. 44 bytes of
 * bookkeeping so browsers will play it — done server-side because every
 * client (desktop, iOS Safari, whatever comes later) would otherwise
 * each need to reimplement it. */
function pcmToWavBase64(pcmB64: string, sampleRate: number): string {
  const pcm = Uint8Array.from(atob(pcmB64), (c) => c.charCodeAt(0));
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  const byteRate = sampleRate * 2; // mono, 16-bit
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  v.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);

  // Chunked btoa — spreading a multi-megabyte array into one
  // String.fromCharCode call overflows the argument limit.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < wav.length; i += CHUNK) {
    binary += String.fromCharCode(...wav.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
