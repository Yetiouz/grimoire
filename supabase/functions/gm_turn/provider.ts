// provider.ts — the ONLY provider-specific code in this function.
//
// Written against an OpenAI-compatible /chat/completions shape so Gemini,
// Groq and Claude are all reachable by changing three environment variables.
// Swapping providers must never require touching index.ts.

export type ToolCall = { id: string; name: string; args: unknown };
export type Completion = {
  text: string;
  toolCalls: ToolCall[];
  inputTokens: number | null;
  outputTokens: number | null;
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
      inputTokens: 10, outputTokens: 5, raw: { stub: "loop" },
    };
  }

  if (last.includes("__vary")) {
    // Different arguments each time → brake 1 (round-trip cap).
    return {
      text: "",
      toolCalls: [{
        id: "stub",
        name: "roll_dice",
        args: { die: "d20", nonce: crypto.randomUUID() },
      }],
      inputTokens: 10, outputTokens: 5, raw: { stub: "vary" },
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
    inputTokens: 10, outputTokens: 12, raw: { stub: "text" },
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
  const choice = body.choices?.[0]?.message ?? {};

  return {
    text: choice.content ?? "",
    toolCalls: (choice.tool_calls ?? []).map((t: {
      id: string;
      function: { name: string; arguments: string };
    }) => ({
      id: t.id,
      name: t.function?.name,
      args: safeParse(t.function?.arguments),
    })),
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
    raw: body,
  };
}

function safeParse(s: string | undefined): unknown {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return { _unparsed: s }; }
}

// ── retry with backoff, for the free tier's low requests-per-minute ──
export async function complete(
  system: string,
  messages: Message[],
  tools: unknown[],
  signal: AbortSignal,
): Promise<Completion> {
  if (MODE === "stub") return await stubComplete(messages, signal);

  const delays = [1000, 3000, 8000];
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
