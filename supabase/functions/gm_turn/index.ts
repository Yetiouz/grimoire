// gm_turn — Slice 16 (the AI GM and the rules chat) + Slice 17 (the GM
// acts: sealed outcome bands and the three tools).
//
// Three surfaces through one function, separated by `mode`:
//   play  — in-fiction. Full campaign packet including the journal, the
//           grimdark persona, and the canon brief. Tool calls are declared
//           only in this mode (see TOOL_SCHEMAS below); a reply that used
//           no tools is still written into journal_entries by the client,
//           same as slice 16 — see `loggedByTool` in the reply.
//   rules — out-of-character. No journal in the packet, no persona, no
//           canon, no tools; a rules-reference framing plus the
//           quick-reference files instead. Its replies go to gm_chat, are
//           private to the asker, and NEVER reach the journal.
//   speak — read-aloud (tts.ts). Turns a narration entry's text into
//           audio through the same provider key. No context build, no
//           model conversation — one TTS request, counted against the
//           same daily budget, telemetry mode "speak". The client falls
//           back to the browser's own voice on any non-ok status, so
//           this path failing can never break the speaker button.
//
// Slice 17's tools (tools.ts): log_journal_entry, roll_dice (a GM-only
// dice pool, created fresh per play turn), adjust_character_hp, and
// propose_check (sealed outcome bands — resolution is pure app, no
// provider request; see gm_checks/resolve_check in migration 0017/0020).
// note_invention is a fifth, small tool for gm_turns.inventions.
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
import { PROTOCOL, RULES_ASSISTANT, TRANSLATION } from "./prompt.ts";
import { synthesize } from "./tts.ts";
import { DiceViolation, TOOL_REGISTRY, TOOL_SCHEMAS, type ToolCtx } from "./tools.ts";

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
  let mode: "play" | "rules" | "speak";
  try {
    const body = await req.json();
    campaignId = String(body.campaignId ?? "");
    sessionId = body.sessionId ? String(body.sessionId) : null;
    input = String(body.input ?? "");
    probe = body.probe === true;
    mode = body.mode === "rules" ? "rules" : body.mode === "speak" ? "speak" : "play";
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
  // whoever asks the most questions. A speak turn is exactly one TTS
  // request — reserving a text turn's full worst case for it would
  // refuse read-alouds while budget for them still existed.
  const worstCase = mode === "speak" ? 1 : MAX_ROUNDTRIPS + 1;
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

  // ── speak: one TTS request, then out ──────────────────────────────
  // Before the text-turn machinery on purpose: none of it (context,
  // packs, history, the tool loop) applies to reading existing words
  // aloud, and sharing its code path would mean sharing its failure
  // modes too.
  if (mode === "speak") {
    // TTS gets its OWN, much shorter timeout — not the text turn's 60s.
    // Discovered live: the free tier throttles TTS aggressively, and a
    // throttled request doesn't 429, it just sits in Google's queue
    // until the timeout kills it. With a 60s ceiling that meant a
    // player pressing play, hearing nothing for a full minute, then
    // getting the browser voice — indistinguishable from a dead
    // button. 20s is enough for every synthesis that is actually going
    // to happen (observed: ~4-10s) and fails over fast when it isn't.
    const TTS_TIMEOUT_MS = Number(Deno.env.get("GM_TTS_TIMEOUT_MS") ?? "20000");
    const speakController = new AbortController();
    const speakTimer = setTimeout(() => speakController.abort(), TTS_TIMEOUT_MS);
    let ttsAudio: string | null = null;
    let ttsErr: string | null = null;
    try {
      const result = await synthesize(input, speakController.signal);
      ttsAudio = result.audio;
      ttsErr = result.error;
    } catch (e) {
      ttsErr = speakController.signal.aborted
        ? "tts timeout"
        : ((e as Error).message?.slice(0, 300) ?? "unknown");
    } finally {
      clearTimeout(speakTimer);
    }

    const speakStatus = ttsAudio ? "ok" : "error";
    await record(supabase, campaignId, sessionId, speakStatus, 1, {
      errMsg: ttsErr, mode: "speak",
    });
    return reply({
      status: speakStatus,
      mode: "speak",
      // The audio rides the same structured 200 as everything else.
      // WAV base64; the client turns it into a Blob and plays it.
      audio: ttsAudio,
      message: ttsAudio ? "" : "The GM's voice is unavailable right now.",
      requestCount: 1,
      providerMode,
      budget: {
        used: used + 1, limit: DAILY_BUDGET,
        yours: yours + 1, yourLimit: PLAYER_CAP,
      },
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
  // Slice 17: whether log_journal_entry actually logged narration this
  // turn, and any world facts the GM flagged via note_invention. Both
  // ride back in the reply/telemetry regardless of how the turn ends.
  let narrationLoggedByTool = false;
  const inventions: { name: string; detail: string }[] = [];

  try {
    // Order matters: standing instructions first (stable, and the part
    // worth caching on a paid key), then the live database last so the
    // most current facts sit closest to the question.
    const context = await buildContext(supabase, campaignId, sessionId, mode === "play");
    contextStats = context.stats;

    // The system pack: the per-game text (persona, rules references, house
    // rules) as database rows, keyed by campaigns.system. This is the
    // multi-system seam cashed in — Mörk Borg is an INSERT, and editing the
    // GM's voice is a SQL update applied here on the very next turn.
    const { data: packData } = await supabase
      .from("system_packs")
      .select("section, body, use_in_play, use_in_rules, sort_order")
      .eq("system", context.system)
      .order("sort_order");
    const pack = (packData ?? []) as
      { section: string; body: string; use_in_play: boolean; use_in_rules: boolean }[];

    if (pack.length === 0) {
      // Fail loud, not vague: a GM running with no persona and no rules
      // reference would still produce fluent text, which is worse than an
      // error because it would be believed.
      clearTimeout(timer);
      await record(supabase, campaignId, sessionId, "error", 0, {
        errMsg: `no system pack for '${context.system}'`, mode,
      });
      return reply({
        status: "error",
        mode,
        message: `No system pack is installed for '${context.system}', so the GM has no persona or rules to run with. Add rows to system_packs for this system.`,
        requestCount: 0,
        providerMode,
        budget: { used, limit: DAILY_BUDGET, yours, yourLimit: PLAYER_CAP },
      });
    }

    const packPlay  = pack.filter((r) => r.use_in_play).map((r) => r.body);
    const packRules = pack.filter((r) => r.use_in_rules).map((r) => r.body);

    // Assembly order is unchanged from the hardcoded era — stable standing
    // instructions first (the cacheable part on a paid key), the live
    // database last so current facts sit closest to the question. Canon
    // (campaigns.canon) joins in play mode only; rules mode never saw it.
    const system = mode === "rules"
      // Rules mode swaps the persona for RULES_ASSISTANT rather than adding
      // to it. Keeping the grimdark voice here would produce atmospheric
      // rulings, which is the worst of both — it reads as authoritative and
      // is harder to check.
      ? [RULES_ASSISTANT, ...packRules, context.text].join("\n\n---\n\n")
      : [...packPlay, PROTOCOL, TRANSLATION, ...(context.canon ? [context.canon] : []), context.text]
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

    // Slice 17: a fresh sealed dice pool per play turn, created here
    // regardless of whether the GM ends up rolling anything — the spec's
    // own build order calls for creating it "at turn start", and these
    // are cheap, turn-scoped rows that are harmless to orphan (0018's
    // migration comment). Rules mode never touches dice or the other
    // tools, so it skips this and gets an empty tool declaration below.
    let dicePoolId: string | null = null;
    if (mode === "play") {
      const { data: poolId } = await supabase.rpc("gm_create_dice_pool", {
        p_campaign_id: campaignId,
      });
      dicePoolId = (poolId as string) ?? null;
    }
    const toolCtx: ToolCtx = {
      supabase, campaignId, sessionId, dicePoolId,
      markNarrationLogged: () => { narrationLoggedByTool = true; },
      addInvention: (name, detail) => { inventions.push({ name, detail }); },
    };
    // Tools are declared to the provider in play mode only. Rules mode
    // gets an empty array — same as every turn before this slice — so a
    // rules question is never even offered a way to touch game state.
    const tools = mode === "play" ? TOOL_SCHEMAS : [];

    while (true) {
      // Brake 1 — round-trip cap.
      if (requests > MAX_ROUNDTRIPS) { status = "capped"; break; }
      requests++;

      const res = await complete(system, messages, tools, controller.signal);
      transcript.push({ request: messages.slice(-2), response: res.raw });
      inTok += res.inputTokens ?? 0;
      outTok += res.outputTokens ?? 0;

      // Capture narration text from ANY round, not just a final tool-less
      // one. Slice 17's check flow wants "the narration and the check
      // arrive together" in one request (SLICE_17_SPEC.md) — some
      // providers put both content and tool_calls on the same message,
      // in which case this captures it immediately; providers that null
      // out content while calling a tool (common) instead produce the
      // real narration on the next, tool-less round, which still
      // overwrites this with the real text. Either way `text` ends up
      // holding the last non-empty narration the GM actually said.
      if (res.text && res.text.trim()) text = res.text;

      if (!res.toolCalls.length) {
        // 2026-08-09: a provider can reject an undeclared/malformed
        // tool-call attempt and hand back a completion with no text and
        // no toolCalls at all — a model can try to call something it
        // read about in the prompt that isn't declared (see prompt.ts's
        // TRANSLATION fix history). That used to fall through as a
        // silent "ok" with a blank message: the turn still spent a
        // request, but nothing was said and — since an empty message
        // never gets logged — nothing reached the journal either, with
        // no sign anything went wrong. Treat it as the real failure it
        // is instead.
        if (!text.trim()) {
          status = "error";
          errMsg = `empty completion${res.finishReason ? ` (${res.finishReason})` : ""}`;
        }
        break;
      }

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

      // res.rawToolCalls (not res.raw, the whole response body) is the
      // exact shape the provider needs to see echoed back — see
      // provider.ts's 2026-08-09 note on why this was wrong before any
      // real tool existed to expose the bug.
      messages.push({ role: "assistant", content: res.text || null, tool_calls: res.rawToolCalls });
      let diceViolation: string | null = null;
      for (const tc of res.toolCalls) {
        // Gated on mode here, not just on what was declared to complete()
        // above: a REAL provider given tools=[] never emits a tool call to
        // begin with, but stub mode's __loop/__vary brake simulations
        // (provider.ts) ignore the declared tools entirely and always
        // return a canned roll_dice call, regardless of mode — including
        // from test-gm-turn-brakes.ts, which deliberately drives them
        // through mode "rules" as a cheap, journal-free surface. Without
        // this gate, that would dispatch a REAL roll_dice against a rules
        // turn's nonexistent dice pool and mis-fire dice_violation instead
        // of the looped/capped status the brake test expects.
        const handler = mode === "play" ? TOOL_REGISTRY[tc.name] : undefined;
        let content: string;
        if (!handler) {
          content = `unknown tool: ${tc.name}`;
        } else {
          try {
            content = await handler(tc.args, toolCtx);
          } catch (e) {
            if (e instanceof DiceViolation) {
              diceViolation = e.message;
              content = e.message;
            } else {
              content = `error: ${(e as Error).message?.slice(0, 300) ?? "tool failed"}`;
            }
          }
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content });
        // Stop dispatching the rest of this batch the moment one call
        // proves the pool was violated — no point drawing further dice
        // from a pool already flagged as compromised this turn.
        if (diceViolation) break;
      }
      // Brake 4 — the GM dice pool is a closed system by design (0018):
      // any failure consuming it aborts the turn outright rather than
      // feeding an error back for a retry, same severity as the other
      // three brakes.
      if (diceViolation) {
        status = "dice_violation";
        errMsg = diceViolation;
        break;
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
    inTok, outTok, transcript, errMsg, contextStats, mode, inventions,
  });

  return reply({
    status,
    mode,
    // Brake/error statuses always get their fixed message, even if a
    // round captured some partial narration before things went wrong —
    // that partial text was never meant to reach the player as the
    // reply (see the loop's own comment on why `text` is now captured
    // on every round rather than only a clean final one).
    message: status === "ok" ? (text || messageFor(status)) : messageFor(status),
    requestCount: requests,
    providerMode,
    budget: {
      used: used + requests, limit: DAILY_BUDGET,
      yours: yours + requests, yourLimit: PLAYER_CAP,
    },
    context: contextStats,
    // Slice 17: true when the GM logged its own narration via
    // log_journal_entry this turn. The client's pre-slice-17 fallback
    // (auto-logging `message` as a journal entry) should run only when
    // this is false — otherwise the same narration lands twice.
    loggedByTool: narrationLoggedByTool,
  });
});

function messageFor(status: string): string {
  switch (status) {
    case "capped":         return "The GM went round in circles and was stopped.";
    case "looped":         return "The GM repeated itself and was stopped.";
    case "timeout":        return "The GM took too long and was stopped.";
    case "dice_violation": return "The GM's dice pool was violated and the turn was stopped. Your journal is unaffected.";
    case "error":          return "The GM hit an error. Your journal is unaffected.";
    default:               return "";
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
    contextStats?: unknown; mode?: string; inventions?: { name: string; detail: string }[];
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
      // Slice 17: gm_turns.inventions has existed since migration 0010
      // and been passed null on every turn until now.
      p_inventions: extra?.inventions && extra.inventions.length ? extra.inventions : null,
      p_error: extra?.errMsg ?? null,
      p_mode: extra?.mode ?? "play",
    });
  } catch (_) { /* ignore */ }
}
