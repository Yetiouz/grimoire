// provider.ts — the ONLY provider-specific code in this function.
//
// Written against an OpenAI-compatible /chat/completions shape so Gemini,
// Groq and Claude are all reachable by changing three environment variables.
// Swapping providers must never require touching index.ts.

export type ToolCall = { id: string; name: string; args: unknown };
export type Completion = {
  text: string;
  toolCalls: ToolCall[];
  /** The tool_calls array EXACTLY as the provider sent it (id/type/
   * function.name/function.arguments-as-a-string), for echoing straight
   * back into the next request's assistant message. `toolCalls` above is
   * a parsed convenience shape for index.ts's own logic — it is NOT
   * valid to send back as a message's `tool_calls` field, and until
   * slice 17 nothing ever did (TOOL_SCHEMAS was empty, so a real model
   * never legitimately produced tool_calls here — see prompt.ts's
   * 2026-08-09 fix). Slice 17 is what makes this path load-bearing for
   * the first time; index.ts now uses this field, not `raw`, when it
   * re-adds the assistant's turn to the conversation. */
  rawToolCalls: unknown[];
  inputTokens: number | null;
  outputTokens: number | null;
  /** The provider's own finish_reason, when it gives one — e.g. "stop",
   * "length", or (2026-08-09, added after a real incident) something
   * like "function_call_filter: MALFORMED_FUNCTION_CALL", which is what
   * an undeclared/rejected tool-call attempt looks like: no text, no
   * tool_calls, just this. index.ts uses it to tell a real empty
   * completion apart from a normal one and to record what actually
   * happened rather than a bare "empty". */
  finishReason: string | null;
  raw: unknown;
};

export type Message = { role: string; content: unknown; [k: string]: unknown };

const MODE = Deno.env.get("GM_PROVIDER_MODE") ?? "stub";

// ── stub mode ────────────────────────────────────────────────────────
// Phase 1 ships in stub mode so the whole harness — auth, budget, the
// three loop brakes, telemetry — is verifiable without a provider key and
// without spending quota. The magic strings let each brake be triggered
// deliberately from the app.
async function stubComplete(messages: Message[], signal: AbortSignal): Promise<Completion> {
  // Scan the WHOLE conversation, not just the last message. After the
  // first tool call the last message is the harness's own tool result
  // ("unknown tool: roll_dice"), so a last-message check would lose the
  // magic string on iteration two and fall through to a normal reply —
  // meaning the brakes would look fine while never actually firing.
  const last = JSON.stringify(messages);

  if (last.includes("__loop")) {
    // Same tool, same arguments, forever → brake 2 (repeat detection).
    return {
      text: "",
      toolCalls: [{ id: "stub", name: "roll_dice", args: { die: "d20" } }],
      rawToolCalls: [{ id: "stub", type: "function",
        function: { name: "roll_dice", arguments: JSON.stringify({ die: "d20" }) } }],
      inputTokens: 10, outputTokens: 5, finishReason: "tool_calls", raw: { stub: "loop" },
    };
  }

  if (last.includes("__vary")) {
    // Different arguments each time → brake 1 (round-trip cap).
    const nonce = crypto.randomUUID();
    return {
      text: "",
      toolCalls: [{ id: "stub", name: "roll_dice", args: { die: "d20", nonce } }],
      rawToolCalls: [{ id: "stub", type: "function",
        function: { name: "roll_dice", arguments: JSON.stringify({ die: "d20", nonce }) } }],
      inputTokens: 10, outputTokens: 5, finishReason: "tool_calls", raw: { stub: "vary" },
    };
  }

  if (last.includes("__hang")) {
    // Never returns in time → brake 3 (wall-clock timeout).
    //
    // This MUST honour the abort signal. A plain 90s sleep would simply
    // outlast the turn timeout and then resolve successfully, so the
    // brake would appear not to work while actually being untested —
    // the worst of both. Rejecting on abort is what makes the timeout
    // observable.
    await new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("stub hang elapsed")), 90_000);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      }, { once: true });
    });
  }

  return {
    text: "[stub GM] The plumbing works. Phase 1 is alive.",
    toolCalls: [],
    rawToolCalls: [],
    inputTokens: 10, outputTokens: 12, finishReason: "stop", raw: { stub: "text" },
  };
}

// ── live mode ────────────────────────────────────────────────────────
async function liveComplete(
  system: string,
  messages: Message[],
  tools: unknown[],
  signal: AbortSignal,
): Promise<Completion> {
  const base = (Deno.env.get("MODEL_BASE_URL") ?? "").replace(/\/$/, "");
  const key = Deno.env.get("MODEL_API_KEY");
  const model = Deno.env.get("MODEL_NAME");
  if (!base || !key || !model) throw new Error("provider not configured");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [{ role: "system", content: system }, ...messages],
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  if (res.status === 429) {
    const e = new Error("rate_limited");
    (e as { retryable?: boolean }).retryable = true;
    throw e;
  }
  if (!res.ok) {
    throw new Error(`provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const body = await res.json();
  const choice = body.choices?.[0] ?? {};
  const message = choice.message ?? {};

  return {
    text: message.content ?? "",
    toolCalls: (message.tool_calls ?? []).map((t: {
      id: string;
      function: { name: string; arguments: string };
    }) => ({
      id: t.id,
      name: t.function?.name,
      args: safeParse(t.function?.arguments),
    })),
    rawToolCalls: message.tool_calls ?? [],
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
    finishReason: choice.finish_reason ?? null,
    raw: body,
  };
}

function safeParse(s: string | undefined): unknown {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return { _unparsed: s }; }
}

// ── retry with backoff, for the free tier's low requests-per-minute ──
//
// 2026-08-18: widened from [1000, 3000, 8000] (12s total) after a real
// session showed rate_limited surfacing to the player repeatedly even
// though each individual burst cleared within a minute or so — the old
// budget just wasn't long enough to wait out a free-tier per-minute
// window. This is a mitigation, not a fix: it makes an occasional
// rate-limited call quietly succeed instead of erroring, but it cannot
// create request budget that free-tier quota doesn't have. If the
// account moves off the free tier (billing enabled → ~30x more RPM),
// these delays stop mattering because 429s stop happening in the first
// place. Kept under TURN_TIMEOUT_MS (index.ts, default 60s) with room
// to spare for the request itself and any other tool round-trips in the
// same turn — that ceiling is why this isn't wider still.
export async function complete(
  system: string,
  messages: Message[],
  tools: unknown[],
  signal: AbortSignal,
): Promise<Completion> {
  if (MODE === "stub") return await stubComplete(messages, signal);

  const delays = [1500, 4000, 9000, 15000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await liveComplete(system, messages, tools, signal);
    } catch (err) {
      const retryable = (err as { retryable?: boolean })?.retryable;
      if (!retryable || attempt >= delays.length || signal.aborted) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

export const providerMode = MODE;
