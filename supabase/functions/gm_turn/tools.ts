// tools.ts — Slice 17: the GM's tool registry.
//
// log_journal_entry, roll_dice (GM pool only), adjust_character_hp,
// adjust_gold, update_quest_status, propose_check, note_invention, and
// (phase 4, encounter mode's AI GM combat tools — grimoire-phase19-
// encounter-mode-scope.md) start_encounter, add_monster, damage_monster,
// reveal_monster, roll_initiative, advance_turn, end_encounter,
// resolve_dying_turn, resolve_stabilize_check, resolve_morale_check.
// Every handler runs on the CALLER'S JWT via the client index.ts already
// built — the AI is constrained by RLS and the membership checks inside
// these RPCs exactly as a human is. Nothing here ever touches a
// service-role key.
//
// 2026-08-19: added adjust_gold and update_quest_status. The 2026-08-18
// Black Road audit found gold and quest status had been narrated in prose
// for weeks with nothing ever written back to the database — the fix wires
// up adjust_character_gold (an RPC that already existed from 0009, just
// never exposed here) and a new update_quest_status RPC (0034). See
// grimoire-gold-quest-tools-pending.md in the Shadowdark Claude Project for
// the full rationale.
//
// 2026-08-20, phase 4: added the ten combat tools above. All the RPCs they
// call already existed and were isolated-SQL-verified for encounter mode
// phases 1 and 3 (migrations 0031/0035) — this is purely the orchestration
// layer wiring them into the AI GM's tool loop, same shape as every tool
// already here. Everything from start_encounter through
// resolve_morale_check except the two dying/stabilize ones is
// `role = 'owner'`-gated at the RPC level, same as the human-GM UI
// (EncounterPanel.tsx) already is — see each handler's own comment.
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

// Phase 4 — same shape as resolveCharacter above (exact match first, then
// a case-insensitive match only if it's unambiguous), scoped to this
// campaign's current encounter_monsters rows. RLS already limits what
// comes back to what this caller could see (0031's own policy), so a
// monster hidden from a non-owner caller is correctly invisible here too,
// not just filtered out of the UI.
async function resolveMonster(ctx: ToolCtx, label: string) {
  const { data } = await ctx.supabase
    .from("encounter_monsters")
    .select("id, label, stat_block")
    .eq("campaign_id", ctx.campaignId);
  const rows = (data ?? []) as { id: string; label: string; stat_block: Record<string, unknown> }[];
  if (rows.length === 0) throw new Error("no monsters in the current encounter");
  const exact = rows.find((r) => r.label === label);
  if (exact) return exact;
  const ci = rows.filter((r) => r.label.toLowerCase() === label.trim().toLowerCase());
  if (ci.length === 1) return ci[0];
  throw new Error(`no monster named "${label}" — known monsters: ${rows.map((r) => r.label).join(", ")}`);
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
      name: "adjust_gold",
      description:
        "Apply a change to a player character's coin purse — a payment received, an expense, a find. Applies instantly and renders as a visible system line — never state a character's gold changed (a fee paid, a reward received, coin recovered) without calling this. Positive values add, negative subtract; use whichever denominations actually apply, leave the rest at 0.",
      parameters: {
        type: "object",
        properties: {
          characterName: { type: "string" },
          gp: { type: "integer", description: "Gold piece delta. Negative for a cost, positive for a gain. Defaults to 0." },
          sp: { type: "integer", description: "Silver piece delta. Defaults to 0." },
          cp: { type: "integer", description: "Copper piece delta. Defaults to 0." },
          reason: {
            type: "string",
            description: "Why — shown to the player in the visible system line, e.g. 'Brannic's fee for the armor commission'.",
          },
        },
        required: ["characterName", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_quest_status",
      description:
        "Update a quest's status when something in play actually changes it — accepted, resolved, abandoned, escalated, whatever the real shift is. Call this instead of only narrating the change in prose; otherwise the tracker goes stale even though the story moved on. Applies instantly and renders as a visible system line. This cannot create a new quest or rewrite its goal — only move its status and optionally append one short note to its summary.",
      parameters: {
        type: "object",
        properties: {
          questCode: {
            type: "string",
            description: "The quest's code exactly as shown in CURRENT STATE, e.g. 'Q-002'.",
          },
          newStatus: {
            type: "string",
            description: "Short status label, e.g. 'Resolved', 'Abandoned', 'Active — critical'.",
          },
          note: {
            type: "string",
            description: "Optional one-sentence addition to the quest's summary explaining what changed.",
          },
        },
        required: ["questCode", "newStatus"],
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
  {
    type: "function",
    function: {
      name: "start_encounter",
      description:
        "Begin combat. Call this the moment the scene turns to a fight, before adding any monster — it opens the turn tracker the players see, and a monster added before this exists won't render for them yet. Safe to call again mid-fight (a surprise round, a GM restart); it clears any prior turn order back to empty.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "add_monster",
      description:
        "Add one monster or NPC combatant to the current encounter — call start_encounter first. Use a distinct label per individual (e.g. 'Goblin #1', 'Goblin #2') so each can be targeted and damaged separately, matching how the table actually tracks them. Visible to players by default, since adding one is usually the moment they become aware of it — set revealToPlayers false for something lurking that hasn't been spotted yet.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "This monster's own name/label, e.g. 'Goblin #2' or 'Bell-Warden'." },
          hpMax: { type: "integer", description: "Max HP. Omit to leave HP untracked for this monster." },
          ac: { type: "integer" },
          dexMod: { type: "integer", description: "DEX modifier, used for this monster's share of initiative. Defaults to 0." },
          attacks: { type: "array", items: { type: "string" }, description: "Short attack descriptions, e.g. 'rusty shortsword +2 (1d6)'." },
          notes: { type: "string", description: "GM-only tactics/notes — never shown to players regardless of visibility." },
          zone: { type: "string", enum: ["close", "near", "far"], description: "Defaults to 'near'." },
          revealToPlayers: { type: "boolean", description: "Whether players can see this monster exists. Defaults to true." },
          revealHp: { type: "boolean", description: "Whether players can see its HP. Defaults to false — most tables keep monster HP hidden." },
        },
        required: ["label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "damage_monster",
      description:
        "Apply damage or healing to a monster already in the encounter, by its label. Applies instantly and renders as a visible system line when it's a visible monster. Floors at 0, ceilings at its own hpMax.",
      parameters: {
        type: "object",
        properties: {
          monsterLabel: { type: "string" },
          delta: { type: "integer", description: "Negative for damage, positive for healing." },
          reason: { type: "string" },
        },
        required: ["monsterLabel", "delta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reveal_monster",
      description:
        "Change whether a monster (and/or its HP) is visible to the players — e.g. revealing something that was lurking hidden, or hiding one again. Pass only the flag(s) you want to change; the other stays as it was.",
      parameters: {
        type: "object",
        properties: {
          monsterLabel: { type: "string" },
          visibleToPlayers: { type: "boolean" },
          hpVisibleToPlayers: { type: "boolean" },
        },
        required: ["monsterLabel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "roll_initiative",
      description:
        "Roll initiative for every active player character and every monster currently in the encounter, and open the turn order. Every character rolls its own 1d20+DEX; all monsters share one roll using the highest DEX mod among them, per the rulebook. Call this once combat's participants are set — calling it again fully re-rolls and replaces the turn order.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "advance_turn",
      description:
        "Move to the next combatant in the turn order, wrapping to a new round when it runs off the end. Call this once a combatant's turn is actually finished — narration and other tool calls for that combatant should happen before you advance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "end_encounter",
      description:
        "End the current encounter. Logs a short recap of how it ended (round count, each monster's fate) to the journal automatically, then clears the monsters and turn order. Call this once the fight is actually over — fled, defeated, or the scene otherwise resolves — not mid-fight.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_dying_turn",
      description:
        "Resolve one round of a dying character's death timer — call this on that character's own turn, every round they remain dying (CURRENT STATE flags who's dying and reminds you). Rolls a d20: a high enough roll rises them with 1 HP, otherwise the timer counts down, and it reaching 0 means they perish. Applies and logs instantly — never narrate this outcome yourself before calling it.",
      parameters: {
        type: "object",
        properties: { characterName: { type: "string" } },
        required: ["characterName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_stabilize_check",
      description:
        "An ally attempts to stabilize a dying character with a DC 15 INT check — stops the death timer without healing them. Call this when a player says their character is trying to help a dying ally, not before. Applies and logs instantly; never narrate success or failure yourself before calling it.",
      parameters: {
        type: "object",
        properties: {
          characterName: { type: "string", description: "The dying character being stabilized." },
          helperCharacterName: { type: "string", description: "The ally attempting the INT check." },
        },
        required: ["characterName", "helperCharacterName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_morale_check",
      description:
        "Call a DC 15 WIS morale check for one monster — per the rulebook, warranted when a group is reduced to about half its number, or a solo enemy to about half HP. Supply the monster's (or its leader's) WIS modifier yourself; nothing tracks it automatically. Failure means this monster flees immediately and is removed from the encounter — never narrate the outcome yourself before calling it.",
      parameters: {
        type: "object",
        properties: {
          monsterLabel: { type: "string" },
          wisMod: { type: "integer", description: "The monster's (or group leader's) WIS modifier. Defaults to 0." },
        },
        required: ["monsterLabel"],
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
      name: string; hp_current: number; hp_max: number; death_timer_rounds: number | null;
    };
    const line = delta < 0
      ? `${updated.name} takes ${Math.abs(delta)} (${reason}) — ${updated.hp_current}/${updated.hp_max} HP`
      : `${updated.name} heals ${delta} (${reason}) — ${updated.hp_current}/${updated.hp_max} HP`;
    await logSystemLine(ctx, line);
    // Phase 4: adjust_character_hp itself starts the death timer the
    // moment HP hits 0 (migration 0035) — surfaced here so the model
    // learns it happened in the same tool result, rather than only
    // finding out on its next CURRENT STATE read.
    const dyingNote = updated.death_timer_rounds != null
      ? ` — down and dying (timer: ${updated.death_timer_rounds})`
      : "";
    return `ok — ${line}${dyingNote}`;
  },

  async adjust_gold(args, ctx) {
    const gp = Number.isFinite(Number(args?.gp)) ? Math.trunc(Number(args.gp)) : 0;
    const sp = Number.isFinite(Number(args?.sp)) ? Math.trunc(Number(args.sp)) : 0;
    const cp = Number.isFinite(Number(args?.cp)) ? Math.trunc(Number(args.cp)) : 0;
    const reason = typeof args?.reason === "string" && args.reason.trim() ? args.reason.trim() : "unspecified";
    if (gp === 0 && sp === 0 && cp === 0) return "error: at least one of gp/sp/cp must be non-zero";
    let character: { id: string };
    try {
      character = await resolveCharacter(ctx, String(args?.characterName ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const { data, error } = await ctx.supabase.rpc("adjust_character_gold", {
      p_character_id: character.id,
      p_gp: gp, p_sp: sp, p_cp: cp,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "adjust_character_gold failed"}`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      name: string; gold: { gp?: number; sp?: number; cp?: number };
    };
    const g = updated.gold ?? {};
    const purse = `${g.gp ?? 0} gp ${g.sp ?? 0} sp${g.cp ? ` ${g.cp} cp` : ""}`;
    return `ok — ${updated.name} (${reason}): purse now ${purse}`;
  },

  async update_quest_status(args, ctx) {
    const questCode = typeof args?.questCode === "string" ? args.questCode.trim() : "";
    const newStatus = typeof args?.newStatus === "string" ? args.newStatus.trim() : "";
    const note = typeof args?.note === "string" ? args.note.trim() : null;
    if (!questCode) return "error: questCode is required";
    if (!newStatus) return "error: newStatus is required";
    const { data, error } = await ctx.supabase.rpc("update_quest_status", {
      p_campaign_id: ctx.campaignId,
      p_quest_code: questCode,
      p_new_status: newStatus,
      p_note: note,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "update_quest_status failed"} — check the quest code against CURRENT STATE and retry`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      code: string; title: string; status: string;
    };
    return `ok — ${updated.code} (${updated.title}) is now: ${updated.status}`;
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

  async start_encounter(_args, ctx) {
    const { error } = await ctx.supabase.rpc("start_encounter", { p_campaign_id: ctx.campaignId });
    if (error) return `error: ${error.message}`;
    await logSystemLine(ctx, "Combat begins!");
    return "ok — encounter started. Add monsters with add_monster, then roll_initiative when ready.";
  },

  async add_monster(args, ctx) {
    const label = typeof args?.label === "string" ? args.label.trim() : "";
    if (!label) return "error: label is required";
    const zone = ["close", "near", "far"].includes(args?.zone) ? args.zone : "near";
    const statBlock: Record<string, unknown> = {};
    if (Number.isFinite(Number(args?.hpMax)) && Number(args.hpMax) > 0) {
      const hpMax = Math.trunc(Number(args.hpMax));
      statBlock.hp_max = hpMax;
      statBlock.hp_current = hpMax;
    }
    if (Number.isFinite(Number(args?.ac))) statBlock.ac = Math.trunc(Number(args.ac));
    if (Number.isFinite(Number(args?.dexMod))) statBlock.dex_mod = Math.trunc(Number(args.dexMod));
    if (Array.isArray(args?.attacks)) statBlock.attacks = args.attacks.filter((a: unknown) => typeof a === "string");
    if (typeof args?.notes === "string" && args.notes.trim()) statBlock.notes = args.notes.trim();

    const { data, error } = await ctx.supabase.rpc("add_encounter_monster", {
      p_campaign_id: ctx.campaignId,
      p_label: label,
      p_stat_block: statBlock,
      p_zone: zone,
    });
    if (error || !data) return `error: ${error?.message ?? "add_encounter_monster failed"}`;
    const monster = (Array.isArray(data) ? data[0] : data) as { id: string; label: string };

    // add_encounter_monster always inserts hidden (0031's own schema
    // default) — this second call is what actually applies
    // revealToPlayers/revealHp, same two independent flags the human GM's
    // MonsterCard toggles already expose.
    const revealToPlayers = args?.revealToPlayers !== false; // default true
    const revealHp = args?.revealHp === true; // default false
    const { error: visErr } = await ctx.supabase.rpc("set_monster_visibility", {
      p_monster_id: monster.id,
      p_visible_to_players: revealToPlayers,
      p_hp_visible_to_players: revealHp,
    });
    if (visErr) return `error: monster added but visibility could not be set: ${visErr.message}`;

    if (revealToPlayers) await logSystemLine(ctx, `${monster.label} appears!`);
    return `ok — added ${monster.label} to the encounter${revealToPlayers ? "" : " (hidden from players)"}`;
  },

  async damage_monster(args, ctx) {
    const delta = Number(args?.delta);
    const reason = typeof args?.reason === "string" && args.reason.trim() ? args.reason.trim() : "unspecified";
    if (!Number.isFinite(delta) || delta === 0) return "error: delta must be a non-zero integer";
    let monster: { id: string };
    try {
      monster = await resolveMonster(ctx, String(args?.monsterLabel ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const { data, error } = await ctx.supabase.rpc("damage_encounter_monster", {
      p_monster_id: monster.id,
      p_delta: Math.trunc(delta),
    });
    if (error || !data) return `error: ${error?.message ?? "damage_encounter_monster failed"}`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      label: string; stat_block: { hp_current?: number; hp_max?: number }; visible_to_players: boolean;
    };
    const hp = updated.stat_block ?? {};
    const line = delta < 0
      ? `${updated.label} takes ${Math.abs(delta)} (${reason}) — ${hp.hp_current}/${hp.hp_max} HP`
      : `${updated.label} recovers ${delta} (${reason}) — ${hp.hp_current}/${hp.hp_max} HP`;
    if (updated.visible_to_players) await logSystemLine(ctx, line);
    const defeated = (hp.hp_current ?? 0) <= 0 ? " — defeated" : "";
    return `ok — ${line}${defeated}`;
  },

  async reveal_monster(args, ctx) {
    let monster: { id: string };
    try {
      monster = await resolveMonster(ctx, String(args?.monsterLabel ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const visibleToPlayers = typeof args?.visibleToPlayers === "boolean" ? args.visibleToPlayers : null;
    const hpVisibleToPlayers = typeof args?.hpVisibleToPlayers === "boolean" ? args.hpVisibleToPlayers : null;
    if (visibleToPlayers === null && hpVisibleToPlayers === null) {
      return "error: pass at least one of visibleToPlayers/hpVisibleToPlayers";
    }
    const { data, error } = await ctx.supabase.rpc("set_monster_visibility", {
      p_monster_id: monster.id,
      p_visible_to_players: visibleToPlayers,
      p_hp_visible_to_players: hpVisibleToPlayers,
    });
    if (error || !data) return `error: ${error?.message ?? "set_monster_visibility failed"}`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      label: string; visible_to_players: boolean; hp_visible_to_players: boolean;
    };
    if (visibleToPlayers === true) await logSystemLine(ctx, `${updated.label} is revealed!`);
    return `ok — ${updated.label}: ${updated.visible_to_players ? "visible" : "hidden"} to players, HP ${
      updated.hp_visible_to_players ? "shown" : "hidden"}`;
  },

  async roll_initiative(_args, ctx) {
    const { data, error } = await ctx.supabase.rpc("roll_initiative", { p_campaign_id: ctx.campaignId });
    if (error || !data) return `error: ${error?.message ?? "roll_initiative failed"} — is there anyone to roll for?`;
    const turn = (Array.isArray(data) ? data[0] : data) as {
      combatants: { label: string; initiative_roll: number }[];
    };
    const order = turn.combatants.map((c) => `${c.label} (${c.initiative_roll})`).join(", ");
    await logSystemLine(ctx, `Initiative: ${order}`);
    return `ok — initiative order: ${order}`;
  },

  async advance_turn(_args, ctx) {
    const { data, error } = await ctx.supabase.rpc("advance_turn", { p_campaign_id: ctx.campaignId });
    if (error || !data) return `error: ${error?.message ?? "advance_turn failed"}`;
    const turn = (Array.isArray(data) ? data[0] : data) as {
      combatants: { label: string }[]; active_index: number; round_number: number;
    };
    const active = turn.combatants[turn.active_index]?.label ?? "?";
    return `ok — round ${turn.round_number}, now ${active}'s turn`;
  },

  async end_encounter(_args, ctx) {
    const { error } = await ctx.supabase.rpc("end_encounter", {
      p_campaign_id: ctx.campaignId,
      p_session_id: ctx.sessionId,
    });
    if (error) return `error: ${error.message}`;
    // end_encounter itself writes the journal recap when a session is
    // open (0031's own function) — no manual logSystemLine here, that
    // would duplicate it.
    return "ok — encounter ended";
  },

  async resolve_dying_turn(args, ctx) {
    let character: { id: string };
    try {
      character = await resolveCharacter(ctx, String(args?.characterName ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const { data, error } = await ctx.supabase.rpc("resolve_dying_turn", {
      p_character_id: character.id,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "resolve_dying_turn failed"}`;
    const updated = (Array.isArray(data) ? data[0] : data) as {
      name: string; status: string; hp_current: number; death_timer_rounds: number | null;
    };
    if (updated.status === "dead") return `ok — ${updated.name} has died.`;
    if (updated.death_timer_rounds === null) return `ok — ${updated.name} rises with ${updated.hp_current} HP!`;
    return `ok — ${updated.name} is still dying, ${updated.death_timer_rounds} round${
      updated.death_timer_rounds === 1 ? "" : "s"} left.`;
  },

  async resolve_stabilize_check(args, ctx) {
    let character: { id: string };
    let helper: { id: string };
    try {
      character = await resolveCharacter(ctx, String(args?.characterName ?? ""));
      helper = await resolveCharacter(ctx, String(args?.helperCharacterName ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const { data, error } = await ctx.supabase.rpc("resolve_stabilize_check", {
      p_character_id: character.id,
      p_helper_character_id: helper.id,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "resolve_stabilize_check failed"}`;
    const result = data as { success: boolean; roll: number; dc: number };
    return result.success
      ? `ok — stabilized (rolled ${result.roll} vs DC ${result.dc}). The death timer is cleared, they remain unconscious.`
      : `ok — stabilize failed (rolled ${result.roll} vs DC ${result.dc}). The death timer keeps counting down.`;
  },

  async resolve_morale_check(args, ctx) {
    let monster: { id: string };
    try {
      monster = await resolveMonster(ctx, String(args?.monsterLabel ?? ""));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
    const wisMod = Number.isFinite(Number(args?.wisMod)) ? Math.trunc(Number(args.wisMod)) : 0;
    const { data, error } = await ctx.supabase.rpc("resolve_morale_check", {
      p_monster_id: monster.id,
      p_wis_mod: wisMod,
      p_session_id: ctx.sessionId,
    });
    if (error || !data) return `error: ${error?.message ?? "resolve_morale_check failed"}`;
    const result = data as { success: boolean; roll: number; dc: number; fled: boolean; label: string };
    return result.success
      ? `ok — ${result.label} holds (rolled ${result.roll} vs DC ${result.dc}).`
      : `ok — ${result.label} fails morale (rolled ${result.roll} vs DC ${result.dc}) and flees — removed from the encounter.`;
  },
};
