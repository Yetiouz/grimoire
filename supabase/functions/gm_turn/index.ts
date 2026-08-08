// gm_turn — Slice 16, Phase 1 (plumbing).
//
// Auth, membership, kill switch, daily budget, three loop brakes, telemetry.
// No game logic yet: the tool registry is deliberately empty and the context
// packet is a placeholder. Phase 2 fills the packet, phase 3 adds bands.
//
// Two invariants this file exists to guarantee:
//   1. Everything against the database runs with the CALLER'S JWT. The
//      service-role key is never used. RLS and the membership checks inside
//      the existing commands constrain the AI exactly as they do a human.
//   2. No state survives a request. No in-flight flag, no lock row. A turn
//      that crashes, hangs or is abandoned leaves nothing behind, so it can
//      never lock the composer for the next one.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { complete, type Message, providerMode } from "./provider.ts";

const MAX_ROUNDTRIPS = Number(Deno.env.get("GM_MAX_ROUNDTRIPS") ?? "4");
const TURN_TIMEOUT_MS = Number(Deno.env.get("GM_TURN_TIMEOUT_MS") ?? "60000");
const DAILY_BUDGET = Number(Deno.env.get("GM_DAILY_REQUEST_BUDGET") ?? "150");
const KILL = (Deno.env.get("GM_KILL_SWITCH") ?? "false").toLowerCase() === "true";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Every response is 200 with a structured body. Errors render as a system
// entry in the journal; they must never surface as an exception, because an
// exception is how a client gets stuck.
function reply(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Google's free-tier quota resets at midnight Pacific.
function lastPacificMidnight(now = new Date()): Date {
  const tz = "America/Los_Angeles";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(now)) p[part.type] = part.value;
  const asUTC = Date.UTC(
    +p.year, +p.month - 1, +p.day,
    +p.hour % 24, +p.minute, +p.second,
  );
  const offset = asUTC - now.getTime();
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

// Phase 1: empty on purpose. Phase 3 registers log_journal_entry, roll_dice
// and adjust_character_hp here, each mapping to an existing RPC.
const TOOL_REGISTRY: Record<string, unknown> = {};
const TOOL_SCHEMAS: unknown[] = [];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (KILL) {
    return reply({
      status: "disabled",
      message: "The GM is switched off.",
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply({ status: "error", message: "Not signed in." });
  }

  // The caller's JWT, not the service role. This is the security boundary.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return reply({ status: "error", message: "Not signed in." });
  }

  let campaignId: string, sessionId: string | null, input: string;
  try {
    const body = await req.json();
    campaignId = String(body.campaignId ?? "");
    sessionId = body.sessionId ? String(body.sessionId) : null;
    input = String(body.input ?? "");
    if (!campaignId || !input) throw new Error("campaignId and input required");
  } catch (e) {
    return reply({ status: "error", message: `Bad request: ${(e as Error).message}` });
  }

  // Membership. RLS on campaign_members only returns the caller's own rows,
  // so a non-member gets nothing back.
  const { data: member } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (!member) {
    return reply({ status: "error", message: "Not a member of this campaign." });
  }

  // Budget: check BEFORE spending. Hitting our own ceiling gives a clean
  // refusal with a reset time; hitting the provider's gives a 429 mid-scene.
  const since = lastPacificMidnight();
  const { data: spent } = await supabase.rpc("gm_requests_since", {
    p_since: since.toISOString(),
  });
  const used = Number(spent ?? 0);
  if (used + MAX_ROUNDTRIPS + 1 > DAILY_BUDGET) {
    await record(supabase, campaignId, sessionId, "budget_exhausted", 0, null);
    return reply({
      status: "budget_exhausted",
      message: "Daily GM budget reached.",
      used, budget: DAILY_BUDGET,
      resetsAt: new Date(since.getTime() + 86_400_000).toISOString(),
    });
  }

  // ── the turn ──────────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);

  const messages: Message[] = [{ role: "user", content: input }];
  const transcript: unknown[] = [];
  const seen = new Set<string>();
  let requests = 0, inTok = 0, outTok = 0;
  let status = "ok", text = "", errMsg: string | null = null;

  try {
    while (true) {
      // Brake 1 — round-trip cap.
      if (requests > MAX_ROUNDTRIPS) { status = "capped"; break; }
      requests++;

      const res = await complete("You are a placeholder GM.", messages, TOOL_SCHEMAS, controller.signal);
      transcript.push({ request: messages.slice(-2), response: res.raw });
      inTok += res.inputTokens ?? 0;
      outTok += res.outputTokens ?? 0;

      if (!res.toolCalls.length) { text = res.text; break; }

      // Brake 2 — repeat detection. Identical tool + identical arguments
      // twice in one turn is the actual signature of a runaway, and catches
      // it a request earlier than the cap can.
      let looped = false;
      for (const tc of res.toolCalls) {
        const h = `${tc.name}:${JSON.stringify(tc.args)}`;
        if (seen.has(h)) { looped = true; break; }
        seen.add(h);
      }
      if (looped) { status = "looped"; break; }

      messages.push({ role: "assistant", content: null, tool_calls: res.raw });
      for (const tc of res.toolCalls) {
        const handler = TOOL_REGISTRY[tc.name];
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: handler ? "ok" : `unknown tool: ${tc.name}`,
        });
      }
    }
  } catch (e) {
    // Brake 3 — wall-clock timeout lands here via the abort signal.
    status = controller.signal.aborted ? "timeout" : "error";
    errMsg = (e as Error).message?.slice(0, 500) ?? "unknown";
  } finally {
    clearTimeout(timer);
  }

  await record(supabase, campaignId, sessionId, status, requests, {
    inTok, outTok, transcript, errMsg,
  });

  return reply({
    status,
    message: text || messageFor(status),
    requestCount: requests,
    providerMode,
    budget: { used: used + requests, limit: DAILY_BUDGET },
  });
});

function messageFor(status: string): string {
  switch (status) {
    case "capped":  return "The GM went round in circles and was stopped.";
    case "looped":  return "The GM repeated itself and was stopped.";
    case "timeout": return "The GM took too long and was stopped.";
    case "error":   return "The GM hit an error. Your journal is unaffected.";
    default:        return "";
  }
}

async function record(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  sessionId: string | null,
  status: string,
  requests: number,
  extra: {
    inTok?: number; outTok?: number; transcript?: unknown[]; errMsg?: string | null;
  } | null,
) {
  // Telemetry is best-effort: a failure here must never fail the turn.
  try {
    await supabase.rpc("gm_record_turn", {
      p_campaign_id: campaignId,
      p_session_id: sessionId,
      p_status: status,
      p_request_count: requests,
      p_input_tokens: extra?.inTok ?? null,
      p_output_tokens: extra?.outTok ?? null,
      p_transcript: extra?.transcript ?? null,
      p_inventions: null,
      p_error: extra?.errMsg ?? null,
    });
  } catch (_) { /* ignore */ }
}
