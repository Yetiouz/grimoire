// context.ts — assembles what the GM is allowed to know.
//
// Every read here runs on the CALLER'S client, so RLS applies: the GM
// can only ever see a campaign the signed-in user is a member of. There
// is no service-role path and there must never be one.
//
// This file is expected to be rewritten repeatedly. What belongs in the
// packet is one of the main things the spike exists to discover — the
// telemetry in gm_turns is how you'll find out.

import { createClient } from "npm:@supabase/supabase-js@2";

type Client = ReturnType<typeof createClient>;

/** Rough characters-per-token. Only used to keep the journal window from
 * silently eating the whole prompt; a real tokenizer isn't worth pulling
 * into an edge function for a budget this soft. */
const CHARS_PER_TOKEN = 4;
const JOURNAL_TOKEN_BUDGET = Number(Deno.env.get("GM_JOURNAL_TOKEN_BUDGET") ?? "3000");
const JOURNAL_MAX_ENTRIES = Number(Deno.env.get("GM_JOURNAL_MAX_ENTRIES") ?? "60");

export interface ContextStats {
  characters: number;
  quests: number;
  npcs: number;
  factions: number;
  treasure: number;
  entries: number;
  entriesTruncated: boolean;
}

export interface BuiltContext {
  text: string;
  stats: ContextStats;
  /** Which system pack to load — from campaigns.system, the column that
   * has been waiting since migration 0001 for exactly this. */
  system: string;
  /** The campaign's world-facts brief (campaigns.canon). Campaign data,
   * not system data; null for a campaign that hasn't written one yet. */
  canon: string | null;
}

export async function buildContext(
  supabase: Client,
  campaignId: string,
  _sessionId: string | null,
  /** Rules mode omits the journal. A rules question needs the sheet, not
   * the story, and dropping ~3k tokens of narration off every lookup is
   * the difference between rules chat being cheap and it quietly eating
   * the same daily budget as play. Encounter/turn-order state rides on
   * this same flag — it's play state exactly like the journal and the
   * pending check, not something a rules lookup needs either. */
  includeJournal = true,
): Promise<BuiltContext> {
  // Parallel: these are independent reads and the turn is latency-bound.
  const [
    campaignRes, sessionRes, charRes, questRes, npcRes, factionRes, treasureRes,
    entryRes, checksRes, turnOrderRes, monsterRes,
  ] = await Promise.all([
      supabase.from("campaigns").select("name, system, canon").eq("id", campaignId).maybeSingle(),
      supabase.from("sessions").select("number, title, started_at")
        .eq("campaign_id", campaignId).is("ended_at", null).maybeSingle(),
      supabase.from("characters").select(
        "name, class_title, background, alignment_title, level, xp_current, xp_needed," +
        "hp_current, hp_max, ac, gear_current, gear_max, gold, abilities, sheet, status, death_timer_rounds",
      ).eq("campaign_id", campaignId).order("name"),
      supabase.from("quests").select("code, title, status, claimant, goal, summary")
        .eq("campaign_id", campaignId).order("sort_order"),
      supabase.from("npcs").select(
        "name, role, location, attitude, status, is_hireling, hire_terms, stat_block, summary",
      ).eq("campaign_id", campaignId).order("name"),
      supabase.from("factions").select("name, type, leader, territory, goal, disposition, status, notes")
        .eq("campaign_id", campaignId).order("name"),
      supabase.from("treasure").select("name, category, quantity_value, held_by, location, status, notes")
        .eq("campaign_id", campaignId).order("name"),
      // Newest first for the query so the LIMIT keeps the most recent;
      // reversed below so the GM reads them in the order they happened.
      includeJournal
        ? supabase.from("journal_entries").select("kind, body, actor_name, created_at")
          .eq("campaign_id", campaignId).order("created_at", { ascending: false })
          .limit(JOURNAL_MAX_ENTRIES)
        : Promise.resolve({ data: [] }),
      // Slice 17: gm_list_checks never returns `bands` (sealed — see
      // 0017's migration comment), so this is safe to hand straight to
      // the model. Rules mode skips it along with the rest of play state.
      includeJournal
        ? supabase.rpc("gm_list_checks", { p_campaign_id: campaignId })
        : Promise.resolve({ data: [] }),
      // Phase 4 (AI GM combat tools): turn_order is one row per campaign,
      // absent entirely when no encounter has ever been started. Same
      // includeJournal gate as the journal/checks above — combat state
      // is play state, not something a rules lookup needs.
      includeJournal
        ? supabase.from("turn_order").select("combatants, active_index, round_number")
          .eq("campaign_id", campaignId).maybeSingle()
        : Promise.resolve({ data: null }),
      // RLS here (0031's own policy) already limits this to
      // visible_to_players=true rows unless the caller is the owner —
      // exactly the same "the GM only knows what this signed-in user
      // could know" boundary every other read in this function already
      // respects, so no extra filtering is needed here.
      includeJournal
        ? supabase.from("encounter_monsters").select(
            "id, label, stat_block, zone, visible_to_players, hp_visible_to_players",
          ).eq("campaign_id", campaignId).order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

  const campaign = campaignRes.data as { name?: string; system?: string; canon?: string | null } | null;
  const session = sessionRes.data as { number?: number; title?: string } | null;
  const characters = (charRes.data ?? []) as Record<string, unknown>[];
  const quests = (questRes.data ?? []) as Record<string, unknown>[];
  const npcs = (npcRes.data ?? []) as Record<string, unknown>[];
  const factions = (factionRes.data ?? []) as Record<string, unknown>[];
  const treasure = (treasureRes.data ?? []) as Record<string, unknown>[];
  const allEntries = ((entryRes.data ?? []) as Record<string, unknown>[]).slice().reverse();
  // At most one — gm_create_check auto-abandons any prior pending check
  // for the campaign (0017: "one live check at a time"), so filtering for
  // 'pending' here can never surface more than a single row in practice.
  const pendingChecks = ((checksRes.data ?? []) as Record<string, unknown>[])
    .filter((c) => c.status === "pending");
  const turnOrder = turnOrderRes.data as
    { combatants: unknown; active_index: number; round_number: number } | null;
  const combatants = (Array.isArray(turnOrder?.combatants) ? turnOrder!.combatants : []) as
    { combatant_type: string; combatant_id: string; label: string; initiative_roll: number; acted: boolean; moved: boolean }[];
  const monsters = (monsterRes.data ?? []) as Record<string, unknown>[];

  // Trim the journal from the OLD end until it fits. Budgeting by
  // characters rather than entry count matters because entries vary
  // wildly in length — 40 entries is a proxy that breaks the first time
  // someone writes a long one.
  const budgetChars = JOURNAL_TOKEN_BUDGET * CHARS_PER_TOKEN;
  const rendered: string[] = [];
  let used = 0;
  let truncated = false;
  for (let i = allEntries.length - 1; i >= 0; i--) {
    const e = allEntries[i];
    const line = `[${e.kind}] ${e.actor_name ?? "?"}: ${e.body}`;
    if (used + line.length > budgetChars && rendered.length > 0) {
      truncated = true;
      break;
    }
    rendered.unshift(line);
    used += line.length;
  }

  const parts: string[] = [];

  parts.push(`# CURRENT STATE

This is the campaign database. It is authoritative: where it disagrees
with anything else you have been told, including the canon brief, it
wins — and the canon brief is what should be corrected.

Campaign: ${campaign?.name ?? "unknown"} (${campaign?.system ?? "shadowdark"})
Session: ${session ? `${session.number} — ${session.title ?? "untitled"} (open)` : "none open"}`);

  parts.push(`## Player characters
${characters.length === 0 ? "(none)" : characters.map(renderCharacter).join("\n\n")}`);

  const openQuests = quests.filter((q) => String(q.status ?? "").toLowerCase() !== "done");
  parts.push(`## Quests
${openQuests.length === 0 ? "(none open)" : openQuests.map((q) =>
  `- [${q.code}] ${q.title} — ${q.status}${q.claimant ? `, for ${q.claimant}` : ""}
  Goal: ${q.goal}
  ${q.summary}`).join("\n")}`);

  parts.push(`## NPCs
${npcs.length === 0 ? "(none)" : npcs.map((n) =>
  `- ${n.name} — ${n.role}${n.location ? ` (${n.location})` : ""} [${n.status}]${
    n.is_hireling ? " HIRELING" : ""}${n.hire_terms ? `\n  Terms: ${n.hire_terms}` : ""}${
    n.stat_block ? `\n  Stats: ${JSON.stringify(n.stat_block)}` : ""}${
    n.attitude ? `\n  Attitude: ${n.attitude}` : ""}
  ${n.summary}`).join("\n")}`);

  parts.push(`## Factions
${factions.length === 0 ? "(none)" : factions.map((f) =>
  `- ${f.name} — ${f.type}${f.leader ? `, led by ${f.leader}` : ""} [${f.status}]
  Goal: ${f.goal}
  Disposition: ${f.disposition}
  ${f.notes}`).join("\n")}`);

  parts.push(`## Treasure and items
${treasure.length === 0 ? "(none)" : treasure.map((t) =>
  `- ${t.name} (${t.category}) — ${t.quantity_value} [${t.status}]${
    t.held_by ? `, held by ${t.held_by}` : ""}${t.location ? `, at ${t.location}` : ""}
  ${t.notes}`).join("\n")}`);

  if (includeJournal) {
    // Slice 17: so the GM never proposes a second check on top of one
    // it's already waiting on — bands themselves are never in this text,
    // only what a player already sees on the pending check card.
    parts.push(`## Pending check
${pendingChecks.length === 0
  ? "(none — call propose_check when a check is warranted)"
  : pendingChecks.map((c) =>
    `Already awaiting a roll: ${c.ability} DC ${c.dc}${c.advantage ? ` (${c.advantage})` : ""}${
      c.stakes ? ` — ${c.stakes}` : ""}. Do not call propose_check again for this — a new one would ` +
    `abandon it. Narrate around it, or wait, until it resolves.`,
  ).join("\n")}`);

    // Phase 4 (AI GM combat tools): mirrors EncounterPanel's own reading
    // of turn_order/encounter_monsters — a combatant's own place in
    // `combatants` is the source of truth for whose turn it is, not a
    // separately-tracked flag. No combatants (or no turn_order row at
    // all) reads as "no active encounter", same as the human UI's own
    // `encounterOpen = turnOrder !== null` check.
    parts.push(`## Encounter
${!turnOrder || combatants.length === 0
  ? "(no active encounter — call start_encounter when combat begins, then add_monster and roll_initiative)"
  : `Round ${turnOrder.round_number}. It is ${combatants[turnOrder.active_index]?.label ?? "?"}'s turn.

Turn order:
${combatants.map((c, i) =>
  `${i === turnOrder.active_index ? "-> " : "   "}${c.label} (${c.combatant_type}, init ${c.initiative_roll})${c.acted ? " [acted]" : ""}`,
).join("\n")}

Monsters:
${monsters.length === 0 ? "(none)" : monsters.map(renderMonster).join("\n")}`}`);

    parts.push(`## Recent journal${truncated ? " (older entries omitted — this is not the whole campaign)" : ""}
${rendered.length === 0 ? "(empty)" : rendered.join("\n")}`);
  }

  return {
    text: parts.join("\n\n"),
    system: campaign?.system ?? "shadowdark",
    canon: campaign?.canon ?? null,
    stats: {
      characters: characters.length,
      quests: openQuests.length,
      npcs: npcs.length,
      factions: factions.length,
      treasure: treasure.length,
      entries: rendered.length,
      entriesTruncated: truncated,
    },
  };
}

function renderCharacter(c: Record<string, unknown>): string {
  const abilities = c.abilities && typeof c.abilities === "object"
    ? Object.entries(c.abilities as Record<string, unknown>)
      .map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" ")
    : "";
  const dying = c.death_timer_rounds != null
    ? `\nDYING — ${c.death_timer_rounds} round${Number(c.death_timer_rounds) === 1 ? "" : "s"} left on the death timer. ` +
      `Call resolve_dying_turn on this character's own turn.`
    : "";
  return `### ${c.name}
${c.class_title} ${c.level} · ${c.alignment_title ?? ""} · ${c.background ?? ""} [${c.status}]
HP ${c.hp_current}/${c.hp_max} · AC ${c.ac} · XP ${c.xp_current}/${c.xp_needed} · Gold ${c.gold} · Gear ${c.gear_current}/${c.gear_max}
${abilities}
${c.sheet ? JSON.stringify(c.sheet) : ""}${dying}`.trim();
}

// Phase 4 — full detail regardless of visible_to_players/hp_visible_to_players:
// this is the GM's own private view of the encounter (same reasoning
// MonsterCard.tsx's own doc comment gives for `notes` staying owner-only
// in the UI — the GM needs to know everything about a monster to run it,
// whether or not the players can currently see it or its HP).
function renderMonster(m: Record<string, unknown>): string {
  const sb = (m.stat_block ?? {}) as Record<string, unknown>;
  const hp = sb.hp_max != null ? `${sb.hp_current ?? sb.hp_max}/${sb.hp_max} HP` : "HP not set";
  const ac = sb.ac != null ? `AC ${sb.ac}` : "";
  const attacks = Array.isArray(sb.attacks) && sb.attacks.length > 0 ? `Attacks: ${sb.attacks.join(", ")}` : "";
  const notes = sb.notes ? `Notes: ${sb.notes}` : "";
  const visibility = m.visible_to_players ? "visible to players" : "hidden from players";
  return `- ${m.label} — ${hp}${ac ? `, ${ac}` : ""} [${m.zone}, ${visibility}]${
    attacks ? `\n  ${attacks}` : ""}${notes ? `\n  ${notes}` : ""}`;
}
