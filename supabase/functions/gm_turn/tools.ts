// tools.ts — Slice 17: the GM's tool registry.
//
// log_journal_entry, roll_dice (GM pool only), adjust_character_hp,
// propose_check, note_invention. Every handler runs on the CALLER'S JWT via
// the client index.ts already built — the AI is constrained by RLS and the
// membership checks inside these RPCs exactly as a human is. Nothing here
// ever touches a service-role key.
//
// Handler return convention: the string a handler returns becomes that tool
// call's result content, fed straight back to the model. An ordinary,
// self-correctable mistake (an unknown character name, bands that don't
// cover -20..60) comes back as an "error: ..." string so the model can see
// what was wrong and retry within the same turn — it is NOT thrown, because
// throwing would abort the whole turn for something the model can fix in
// its very next tool call. The one deliberate exception is DiceViolation:
// the GM's dice pool is a closed, tamper-evident system by design (0018's
// migration comment: "no API to peek ahead, skip, or re-draw"), so any
// failure consuming it is a genuine integrity problem, not a prompt
// mistake — index.ts catches it specifically and aborts the turn with
// status "dice_violation" rather than feeding it back for a retry.

import type { createClient } from "npm:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;

export class DiceViolation extends Error {}

export interface ToolCtx {
  supabase: Client;
  campaignId: string;
  sessionId: string | null;
  /** Created once at turn start (spec: "create pool at turn start"), null
   * if that RPC failed — roll_dice treats a missing pool as a violation
   * rather than silently skipping the integrity guarantee. */
  dicePoolId: string | null;
  /** Flips true the first time log_journal_entry logs a NARRATION entry
   * this turn. index.ts returns it as `loggedByTool` in the reply so the
   * client knows whether its pre-slice-17 fallback write (auto-logging
   * the completion's plain text) is still needed for this turn, or would
   * duplicate what the GM already wrote itself. */
  markNarrationLogged: () => void;
  /** Accumulates {name, detail} for gm_turns.inventions (column existed
   * since 0010, always null until this slice). */
  addInvention: (name: string, detail: string) => void;
}

// Same cyan as resolve_check's own log_journal_entry call (0017) and the
// unified-feed spec (BOB_queue item 1: "GM narration renders in cyan") —
// one color constant so every GM-authored entry, however it was written,
// looks the same in the feed.
const GM_COLOR = "#35f0ff";

async function logSystemLine(ctx: ToolCtx, body: string) {
  if (!ctx.sessionId) return; // no open session — nothing to log against
  await ctx.supabase.rpc("log_journal_entry", {
    p_campaign_id: ctx.campaignId,
    p_session_id: ctx.sessionId,
    p_kind: "system",
    p_body: body,
    p_actor_name: "GM",
    p_actor_color: GM_COLOR,
  });
}

async function resolveCharacter(ctx: ToolCtx, name: string) {
  const { data } = await ctx.supabase
    .from("characters")
    .select("id, name, hp_current, hp_max")
    .eq("campaign_id", ctx.campaignId);
  const rows = (data ?? []) as { id: string; name: string; hp_current: number; hp_max: number }[];
  if (rows.length === 0) throw new Error("no characters exist in this campaign");
  const exact = rows.find((r) => r.name === name);
  if (exact) return exact;
  const ci = rows.filter((r) => r.name.toLowerCase() === name.trim().toLowerCase());
  if (ci.length === 1) return ci[0];
  throw new Error(`no character named "${name}" — known characters: ${rows.map((r) => r.name).join(", ")}`);
}

export const TOOL_SCHEMAS: unknown[] = [
  {
    type: "function",
    function: {
      name: "log_journal_entry",
      description:
        "Write a narration or system entry to the campaign journal, in your own voice. This is how your reply reaches the players now — call it with your scene's prose every turn that has anything worth recording. Every call is visible to the player immediately and cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string", enum: ["narration", "system"],
            description: "'narration' for story text, 'system' for a short mechanical note.",
          },
          body: {
            type: "string",
            description: "The entry text. Plain prose — no markdown, no headings, no bullet lists.",
          },
        },
        required: ["kind", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "roll_dice",
      description:
        "Roll a die on the GM's own behalf ONLY — a monster's attack, a morale check, a reaction, a random encounter. NEVER use this for anything a player is checking; those always go through propose_check so the player rolls their own dice. Draws the next die from this turn's sealed pool, in a fixed order you cannot see ahead of, skip, or redraw.",
      parameters: {
        type: "object",
        properties: {
          die: { type: "string", enum: ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] },
          reason: {
            type: "string",
            description: "Why you're rolling — shown to the player in the visible system line, e.g. 'bandit's attack roll'.",
          },
        },
        required: ["die", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_character_hp",
      description:
        "Apply damage or healing to a player character, with a reason. Applies instantly and renders as a visible system line — never state a character's HP changed without calling this.",
      parameters: {
        type: "object",
        properties: {
          characterName: { type: "string" },
          delta: { type: "integer", description: "Negative for damage, positive for healing." },
          reason: { type: "string" },
        },
        required: ["characterName", "delta", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_check",
      description:
        "Call for a player check. Commit EVERY possible outcome now, before any die exists — the player will only ever see whichever band matches their actual roll, and every other band stays sealed forever, including from you. Bands must be contiguous, ascending, and jointly cover totals from -20 through 60 with no gaps. Never resolve or describe the outcome yourself in narration — the app reveals it the moment the player rolls or enters a physical roll.",
      parameters: {
        type: "object",
        properties: {
          characterName: { type: "string", description: "Who is making the check." },
          ability: { type: "string", description: "STR, DEX, CON, INT, WIS, or CHA." },
          dc: { type: "integer" },
          advantage: { type: "string", enum: ["advantage", "disadvantage"] },
          stakes: {
            type: "string",
            description: "One line telling the player what's at stake, shown before they roll.",
          },
          bands: {
            type: "array",
            description: "Every possible outcome, contiguous and ascending, covering -20 through 60.",
            items: {
              type: "object",
              properties: {
                min: { type: "integer" },
                max: { type: "integer" },
                text: { type: "string", description: "The narration revealed if this band is hit." },
                hp_delta: {
                  type: "integer",
                  description: "Optional HP change auto-applied when this band is revealed. Negative for damage.",
                },
              },
              required: ["min", "max", "text"],
            },
          },
        },
        required: ["characterName", "ability", "dc", "stakes", "bands"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "note_invention",
      description:
        "Record a world fact you invented this turn that isn't in the campaign's canon brief — a name, a place, a detail you made up to keep the scene moving. Reviewed after the session so it can be folded into canon or flagged as a gap. Optional — call it zero or more times, or not at all.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short label, e.g. 'Innkeep Yorna'." },
          detail: { type: "string", description: "What you invented and why, one or two sentences." },
        },
        required: ["name", "detail"],
      },
    },
  },
];

export const TOOL_REGISTRY: Record<string, (args: any, ctx: ToolCtx) => Promise<string>> = {
  async log_journal_entry(args, ctx) {
    const kind = args?.kind === "system" ? "system" : args?.kind === "narration" ? "narration" : null;
    const body = typeof args?.body === "string" ? args.body.trim() : "";
    if (!kind) return 'error: kind must be "narration" or "system"';
    if (!body) return "error: body is required";
    if (!ctx.sessionId) return "error: no open session — nothing to log against";
    const { error } = await ctx.supabase.rpc("log_journal_entry", {
      p_campaign_id: ctx.campaignId,
      p_session_id: ctx.sessionId,
      p_kind: kind,
      p_body: body,
      p_actor_name: "GM",
      p_actor_color: GM_COLOR,
    });
    if (error) return `error: ${error.message}`;
    if (kind === "narration") ctx.markNarrationLogged();
    return "ok — logged";
  },

  async roll_dice(args, ctx) {
    const die = String(args?.die ?? "");
    const reason = typeof args?.reason === "string" && args.reason.trim() ? args.reason.trim() : "GM roll";
    if (!["d4", "d6", "d8", "d10", "d12", "d20", "d100"].includes(die)) {
      throw new DiceViolation(`invalid die "${die}" requested from the sealed pool — aborting`);
    }
    if (!ctx.dicePoolId) {
      throw new DiceViolation("no dice pool exists for this turn — aborting");
    }
    const { data, error } = await ctx.supabase.rpc("gm_consume_die", {
      p_pool_id: ctx.dicePoolId,
      p_die: die,
    });
    if (error || !data) {
      throw new DiceViolation(`dice pool violation: ${error?.message ?? "consume failed"}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as { value: number };
    await logSystemLine(ctx, `GM rolls ${die} (${reason}): ${row.value}`);
    return `rolled ${row.value}`;
  },

  async adjust_character_hp(args, ctx) {
    const delta = Number(args?.delta);
    const reason = typeof args?.reason === "string" && args.reason.trim() ? args.reason.trim() : "unspecified";
    if (!Number.isFinite(delta) || delta === 0) return "error: delta must be a non-zero integer";
    let character: { id: string };
    try {
      character = await resolveCharacter(ctx, String(args?.characterName ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const { data, error } = await ctx.supabase.rpc("adjust_character_hp", {
      p_character_id: character.id,
      p_delta: delta,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "adjust_character_hp failed"}`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      name: string; hp_current: number; hp_max: number;
    };
    const line = delta < 0
      ? `${updated.name} takes ${Math.abs(delta)} (${reason}) — ${updated.hp_current}/${updated.hp_max} HP`
      : `${updated.name} heals ${delta} (${reason}) — ${updated.hp_current}/${updated.hp_max} HP`;
    await logSystemLine(ctx, line);
    return `ok — ${line}`;
  },

  async propose_check(args, ctx) {
    if (!ctx.sessionId) return "error: no open session — you cannot call for a check right now";
    let characterId: string | null = null;
    if (args?.characterName) {
      try {
        characterId = (await resolveCharacter(ctx, String(args.characterName))).id;
      } catch (e) {
        return `error: ${(e as Error).message}`;
      }
    }
    const advantage = args?.advantage === "advantage" || args?.advantage === "disadvantage"
      ? args.advantage : null;
    const { data, error } = await ctx.supabase.rpc("gm_create_check", {
      p_campaign_id: ctx.campaignId,
      p_session_id: ctx.sessionId,
      p_character_id: characterId,
      p_ability: String(args?.ability ?? ""),
      p_dc: Number(args?.dc),
      p_advantage: advantage,
      p_stakes: typeof args?.stakes === "string" ? args.stakes : null,
      p_bands: args?.bands ?? [],
    });
    if (error) return `error: ${error.message} — fix the bands and retry`;
    return `ok — check created (id ${data})`;
  },

  async note_invention(args, ctx) {
    const name = typeof args?.name === "string" ? args.name.trim() : "";
    const detail = typeof args?.detail === "string" ? args.detail.trim() : "";
    if (!name || !detail) return "error: name and detail are both required";
    ctx.addInvention(name, detail);
    return "ok — noted";
  },
};
