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
   * the same daily budget as play. */
  includeJournal = true,
): Promise<BuiltContext> {
  // Parallel: these are independent reads and the turn is latency-bound.
  const [campaignRes, sessionRes, charRes, questRes, npcRes, factionRes, treasureRes, entryRes] =
    await Promise.all([
      supabase.from("campaigns").select("name, system, canon").eq("id", campaignId).maybeSingle(),
      supabase.from("sessions").select("number, title, started_at")
        .eq("campaign_id", campaignId).is("ended_at", null).maybeSingle(),
      supabase.from("characters").select(
        "name, class_title, background, alignment_title, level, xp_current, xp_needed," +
        "hp_current, hp_max, ac, gear_current, gear_max, gold, abilities, sheet, status",
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
    ]);

  const campaign = campaignRes.data as { name?: string; system?: string; canon?: string | null } | null;
  const session = sessionRes.data as { number?: number; title?: string } | null;
  const characters = (charRes.data ?? []) as Record<string, unknown>[];
  const quests = (questRes.data ?? []) as Record<string, unknown>[];
  const npcs = (npcRes.data ?? []) as Record<string, unknown>[];
  const factions = (factionRes.data ?? []) as Record<string, unknown>[];
  const treasure = (treasureRes.data ?? []) as Record<string, unknown>[];
  const allEntries = ((entryRes.data ?? []) as Record<string, unknown>[]).slice().reverse();

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
  return `### ${c.name}
${c.class_title} ${c.level} · ${c.alignment_title ?? ""} · ${c.background ?? ""} [${c.status}]
HP ${c.hp_current}/${c.hp_max} · AC ${c.ac} · XP ${c.xp_current}/${c.xp_needed} · Gold ${c.gold} · Gear ${c.gear_current}/${c.gear_max}
${abilities}
${c.sheet ? JSON.stringify(c.sheet) : ""}`.trim();
}
