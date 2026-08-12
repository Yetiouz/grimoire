import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Npc = Tables<'npcs'>
export type NpcStatBlock = Tables<'npc_stat_blocks'>
export type Faction = Tables<'factions'>
export type Treasure = Tables<'treasure'>
export type Note = Tables<'campaign_notes'>
export type Location = Tables<'locations'>
export type LocationSecret = Tables<'location_secrets'>

/** NPCs in a campaign, in creation order — this table has no
 * `sort_order` column (unlike `quests`), so `created_at` is the closest
 * mirror of the order Black Road's own `npc-log.md` introduced them in.
 * RLS already scopes this to membership, same as every other
 * campaign-scoped read in this kit.
 *
 * Never includes `stat_block` — migration `npc_stat_blocks_gm_only`
 * (2026-08-10) moved that column out to its own GM-only table (see
 * `listNpcStatBlock` below). RLS is row-level, not column-level, so
 * hiding one field from an otherwise-visible NPC row required a real
 * table split, not a client-side "just don't render it" trick that
 * would still leave the raw value reachable through the same anon key
 * every player has. */
export async function listNpcs(campaignId: string): Promise<Npc[]> {
  const { data, error } = await supabase
    .from('npcs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** The GM-only stat block for one NPC. `npc_stat_blocks_select_gm`
 * (same migration) scopes SELECT to members whose
 * `campaign_members.role = 'owner'` on that NPC's campaign — a
 * non-owner's query simply hits RLS and returns zero rows, not an
 * error, so `maybeSingle` resolving to `null` is exactly "no stat
 * block" for both a genuinely statless NPC and a player who isn't
 * allowed to see one. Callers don't need to know which case they're
 * in: `NpcCard` (task #52) uses this same ambiguity to decide whether
 * to render the GM-only section at all, rather than checking
 * `getCampaignRole` separately first. */
export async function listNpcStatBlock(npcId: string): Promise<NpcStatBlock | null> {
  const { data, error } = await supabase.from('npc_stat_blocks').select('*').eq('npc_id', npcId).maybeSingle()
  if (error) throw error
  return data
}

/** Every GM-only stat block visible to the signed-in user for a whole
 * campaign in one call, rather than one `listNpcStatBlock` round trip per
 * NPC — added for `WorldTabs`' NPC list (2026-08-10), which needs to know
 * up front which of a campaign's ~17 NPCs have a stat block at all so it
 * can decide whether to render `NpcCard`'s GM-only section per row.
 * Same RLS-driven ambiguity as `listNpcStatBlock`: a non-owner's query
 * hits `npc_stat_blocks_select_gm` and comes back an empty array, not an
 * error, so this is naturally `[]` for a player and the real rows for the
 * GM — no separate `getCampaignRole` check needed at the call site. */
export async function listNpcStatBlocks(campaignId: string): Promise<NpcStatBlock[]> {
  const { data, error } = await supabase.from('npc_stat_blocks').select('*').eq('campaign_id', campaignId)
  if (error) throw error
  return data
}

/** Factions in a campaign, in creation order — same "no explicit sort
 * column, `created_at` is the closest real order" reasoning as
 * `listNpcs`. No GM-secret split here: unlike an NPC's combat stat
 * block, faction fields (disposition, territory, leader) are the kind
 * of thing any party member would plausibly know or infer in play. */
export async function listFactions(campaignId: string): Promise<Faction[]> {
  const { data, error } = await supabase
    .from('factions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Treasure in a campaign, in creation order — same reasoning as
 * `listNpcs`/`listFactions`. No GM-secret split: `held_by`/`location`
 * are already party-visible facts (who has the thing, where it
 * currently sits), not hidden GM bookkeeping like an NPC's stat
 * block. */
export async function listTreasure(campaignId: string): Promise<Treasure[]> {
  const { data, error } = await supabase
    .from('treasure')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Locations in a campaign, in creation order — same "no explicit
 * sort column, `created_at` is the closest real order" reasoning as
 * `listNpcs`. Migration `0024_locations` (BUILD_PLAN.md item 15, "GM
 * prep + handouts", slice 1 of 4): replaces `world.md`'s Settlements/
 * Regions/Adventure Sites, which had no in-app equivalent before this.
 *
 * Never includes GM-hidden content — same table-level split as
 * `npcs`/`npc_stat_blocks` (see `listNpcStatBlock`'s doc comment for
 * why a row-level RLS policy needs a real second table, not a
 * client-side "just don't render it" trick). `world.md`'s explicit
 * "Known" vs. "Hidden" sections per location are exactly the same
 * shape as an NPC's public fields vs. its combat stat block. */
export async function listLocations(campaignId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Every GM-only location secret visible to the signed-in user for a
 * whole campaign in one call — same reasoning and same RLS-driven
 * ambiguity as `listNpcStatBlocks` (a non-owner's query hits
 * `location_secrets_select_gm` and comes back `[]`, not an error, so
 * this is naturally empty for a player and the real rows for the GM —
 * no separate `getCampaignRole` check needed at the call site). */
export async function listLocationSecrets(campaignId: string): Promise<LocationSecret[]> {
  const { data, error } = await supabase.from('location_secrets').select('*').eq('campaign_id', campaignId)
  if (error) throw error
  return data
}

/** Campaign notes — the 5th `WorldTabs` tab (2026-08-10, owner's call: a
 * freeform scratchpad, not tied to any single NPC/faction/quest/treasure
 * row). `campaign_notes` (migration `campaign_notes`) intentionally
 * mirrors `factions`/`treasure`'s no-GM-secret RLS shape (one
 * membership-scoped SELECT policy, no per-row visibility split) —
 * there's no equivalent of an NPC's GM-only stat block here.
 *
 * Ordered NEWEST first, unlike `listNpcs`/`listFactions`/`listTreasure`
 * (all oldest-first, "creation order"): those three read like a roster
 * you scan top to bottom, but notes read like a running log — the note
 * you jotted five minutes ago is the one worth seeing without scrolling
 * past the whole history first. */
export async function listCampaignNotes(campaignId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('campaign_notes')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** The signed-in user's `campaign_members.role` for one campaign — null
 * if they aren't a member (shouldn't happen for anything already
 * gated by campaign selection, but `maybeSingle` over `single` keeps
 * that a clean null rather than a thrown error). This is the "know the
 * current user's role" helper the GM/player split needs wherever a
 * component decides whether to show GM-only UI (e.g. NpcCard's stat
 * block section) without relying purely on whether `listNpcStatBlock`
 * happened to come back null.
 *
 * `'owner'` is the only value any row has today (solo play, no invites
 * yet — BUILD_PLAN.md's multiplayer slice is still ahead), but nothing
 * here hardcodes that: it reads whatever role the row actually says, so
 * this keeps working unchanged once real non-owner members exist. */
export async function getCampaignRole(campaignId: string): Promise<string | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role ?? null
}
