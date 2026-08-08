// gm_turn — Slice 16: the AI GM and the rules chat.
//
// Two surfaces through one function, separated by `mode`:
//   play  — in-fiction. Full campaign packet including the journal, the
//           grimdark persona, and the canon brief. Its replies are written
//           into journal_entries by the client.
//   rules — out-of-character. No journal in the packet, no persona, no
//           canon; a rules-reference framing plus the quick-reference files
//           instead. Its replies go to gm_chat, are private to the asker,
//           and NEVER reach the journal.
//
// The tool registry is still empty: phase 3 adds the outcome bands and the
// three commands.
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
import { buildContext } from "./context.ts";
import {
  CANON, ENCOUNTER_TREASURE, HOUSE_RULES, PERSONA, PROTOCOL,
  QUICK_REFERENCE, RULES_ASSISTANT, TRANSLATION,
} from "./prompt.ts";

/** How many prior rules-chat messages to carry. Enough that a follow-up
 * ("what about with the house rule?") works, small enough that a long
 * chat doesn't grow without limit. */
const RULES_HISTORY = Number(Deno.env.get("GM_RULES_HISTORY") ?? "20");

const MAX_ROUNDTRIPS = Number(Deno.env.get("GM_MAX_ROUNDTRIPS") ?? "4");
const TURN_TIMEOUT_MS = Number(Deno.env.get("GM_TURN_TIMEOUT_MS") ?? "60000");
/** The real constraint: everyone in a campaign draws on one provider key,
 * so the ceiling is campaign-wide, not per person. */
const DAILY_BUDGET = Number(Deno.env.get("GM_DAILY_REQUEST_BUDGET") ?? "150");
/** A player's slice of that ceiling, so one person can't spend the day
 * before anyone else sits down. Defaults to the whole thing, which keeps
 * solo play behaving exactly as it does now — set it lower when the table
 * grows. */
const PLAYER_CAP = Number(Deno.env.get("GM_PLAYER_DAILY_CAP") ?? String(DAILY_BUDGET));
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

// Still empty on purpose. Phase 3 registers log_journal_entry, roll_dice
// and adjust_character_hp here, each mapping to an existing RPC.
const TOOL_REGISTRY: Record<string, unknown> = {};
const TOOL_SCHEMAS: unknown[] = [];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (KILL) {
    return reply({
      status: "disabled",
      message: "The GM is switched off.",
      requestCount: 0,
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply({ status: "error", message: "Not signed in.", requestCount: 0 });
  }

  // The caller's JWT, not the service role. This is the security boundary.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return reply({ status: "error", message: "Not signed in.", requestCount: 0 });
  }

  let campaignId: string, sessionId: string | null, input: string, probe: boolean;
  let mode: "play" | "rules";
  try {
    const body = await req.json();
    campaignId = String(body.campaignId ?? "");
    sessionId = body.sessionId ? String(body.sessionId) : null;
    input = String(body.input ?? "");
    probe = body.probe === true;
    mode = body.mode === "rules" ? "rules" : "play";
    if (!campaignId) throw new Error("campaignId required");
    if (!probe && !input) throw new Error("input required");
  } catch (e) {
    return reply({ status: "error", message: `Bad request: ${(e as Error).message}`, requestCount: 0 });
  }

  // Membership. RLS on campaign_members only returns the caller's own rows,
  // so a non-member gets nothing back.
  const { data: member } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (!member) {
    return reply({ status: "error", message: "Not a member of this campaign.", requestCount: 0 });
  }

  // Budget: check BEFORE spending. Hitting our own ceiling gives a clean
  // refusal with a reset time; hitting the provider's gives a 429 mid-scene.
  const since = lastPacificMidnight();
  const { data: budgetRows } = await supabase.rpc("gm_budget_since", {
    p_campaign_id: campaignId,
    p_since: since.toISOString(),
  });
  const row = (Array.isArray(budgetRows) ? budgetRows[0] : budgetRows) as
    { campaign_used?: number; user_used?: number } | null;
  const used = Number(row?.campaign_used ?? 0);
  const yours = Number(row?.user_used ?? 0);

  // A probe reads the counter and stops. No model call, no telemetry
  // row, no provider request spent — it exists so the UI can show an
  // honest "N left today" before the first question of a session rather
  // than only after a reply carries the number back. The ceiling lives
  // here rather than in a VITE_ variable so there is one source of
  // truth for it.
  if (probe) {
    return reply({
      status: "ok",
      message: "",
      requestCount: 0,
      providerMode,
      budget: { used, limit: DAILY_BUDGET, yours, yourLimit: PLAYER_CAP },
    });
  }

  // Two ceilings, and the tighter one wins. The campaign cap protects the
  // provider key; the player cap protects everyone else at the table from
  // whoever asks the most questions.
  const worstCase = MAX_ROUNDTRIPS + 1;
  const overCampaign = used + worstCase > DAILY_BUDGET;
  const overPlayer = yours + worstCase > PLAYER_CAP;
  if (overCampaign || overPlayer) {
    await record(supabase, campaignId, sessionId, "budget_exhausted", 0, { mode });
    return reply({
      status: "budget_exhausted",
      mode,
      message: overPlayer && !overCampaign
        ? "You've used your share of today's GM budget. You can still write your journal by hand."
        : "The table's daily GM budget is spent. You can still write your journal by hand.",
      requestCount: 0,
      providerMode,
      // Same shape on every path — the client reads budget.used /
      // budget.limit and must never get a bare number here.
      budget: { used, limit: DAILY_BUDGET, yours, yourLimit: PLAYER_CAP },
      resetsAt: new Date(since.getTime() + 86_400_000).toISOString(),
    });
  }

  // ── the turn ──────────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);

  const messages: Message[] = [];
  const transcript: unknown[] = [];
  const seen = new Set<string>();
  let requests = 0, inTok = 0, outTok = 0;
  let status = "ok", text = "", errMsg: string | null = null;
  let contextStats: unknown = null;

  try {
    // Order matters: standing instructions first (stable, and the part
    // worth caching on a paid key), then the live database last so the
    // most current facts sit closest to the question.
    const context = await buildContext(supabase, campaignId, sessionId, mode === "play");
    contextStats = context.stats;

    const system = mode === "rules"
      // Rules mode swaps PERSONA for RULES_ASSISTANT rather than adding to
      // it. Keeping the grimdark voice here would produce atmospheric
      // rulings, which is the worst of both — it reads as authoritative
      // and is harder to check.
      ? [RULES_ASSISTANT, QUICK_REFERENCE, ENCOUNTER_TREASURE, HOUSE_RULES, context.text]
        .join("\n\n---\n\n")
      : [PERSONA, HOUSE_RULES, PROTOCOL, TRANSLATION, CANON, context.text]
        .join("\n\n---\n\n");

    // Rules chat is a conversation; play is not. A play turn stands alone
    // because its continuity lives in the journal, which is already in the
    // packet. A rules question needs its own recent history so follow-ups
    // like "what about with the house rule?" resolve.
    if (mode === "rules") {
      const { data: history } = await supabase
        .from("gm_chat")
        .select("role, body")
        .eq("campaign_id", campaignId)
        // RLS already restricts this to the caller's own rows, but the
        // filter is explicit so the intent survives a future policy
        // change: your follow-up must never attach to someone else's
        // question.
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(RULES_HISTORY);
      for (const m of ((history ?? []) as { role: string; body: string }[]).reverse()) {
        messages.push({ role: m.role, content: m.body });
      }
    }
    messages.push({ role: "user", content: input });

    while (true) {
      // Brake 1 — round-trip cap.
      if (requests > MAX_ROUNDTRIPS) { status = "capped"; break; }
      requests++;

      const res = await complete(system, messages, TOOL_SCHEMAS, controller.signal);
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

  // Persist the exchange BEFORE replying. A rules answer that reached the
  // player but never reached the transcript would silently break the
  // conversation's memory on the next question.
  if (mode === "rules" && status === "ok" && text.trim()) {
    try {
      await supabase.rpc("gm_record_chat", {
        p_campaign_id: campaignId, p_role: "user", p_body: input,
      });
      await supabase.rpc("gm_record_chat", {
        p_campaign_id: campaignId, p_role: "assistant", p_body: text,
      });
    } catch (_) { /* best effort: the answer still returns */ }
  }

  await record(supabase, campaignId, sessionId, status, requests, {
    inTok, outTok, transcript, errMsg, contextStats, mode,
  });

  return reply({
    status,
    mode,
    message: text || messageFor(status),
    requestCount: requests,
    providerMode,
    budget: {
      used: used + requests, limit: DAILY_BUDGET,
      yours: yours + requests, yourLimit: PLAYER_CAP,
    },
    context: contextStats,
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
    contextStats?: unknown; mode?: string;
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
      // Context stats ride along in the transcript so how much the GM
      // was shown — and whether the journal window truncated — is
      // recoverable per turn without another column.
      p_transcript: extra?.transcript
        ? { turns: extra.transcript, context: extra?.contextStats ?? null }
        : null,
      p_inventions: null,
      p_error: extra?.errMsg ?? null,
      p_mode: extra?.mode ?? "play",
    });
  } catch (_) { /* ignore */ }
}
