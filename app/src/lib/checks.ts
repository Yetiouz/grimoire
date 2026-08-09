import { supabase } from './supabase'

/** Slice 17: the client side of `gm_checks` (migrations 0017/0019/0020).
 * Sealed by design — `gm_list_checks` never selects `bands`, so nothing
 * in this file can ever see an unresolved outcome, and there is no path
 * here that could. Only two RPCs are needed client-side: listing checks
 * for the feed, and resolving a pending one. Creating a check
 * (`gm_create_check`) and drawing from the GM's own dice pool
 * (`gm_create_dice_pool`/`gm_consume_die`) are GM-tool-only — see
 * `supabase/functions/gm_turn/tools.ts` — the player-facing client never
 * calls either. */

export type CheckStatus = 'pending' | 'resolved' | 'abandoned'
export type Advantage = 'advantage' | 'disadvantage'
export type ResolveSource = 'server' | 'physical'

/** One outcome band. Only ever seen here on an already-resolved check
 * (`resolved_band`) — `gm_list_checks` withholds the full `bands` array
 * for a pending one, and this file has no other way to read the table. */
export interface CheckBand {
  min: number
  max: number
  text: string
  hp_delta?: number
}

/** Shaped from `gm_list_checks`'s return columns, not the generated
 * Supabase types: the generator currently marks every nullable column
 * on that function's return row as non-null (a known limitation for
 * table-returning functions), which would be actively wrong here — the
 * real nullability comes from `gm_checks`' own table Row type instead,
 * which the generator gets right. Same "hand-type over trusting the
 * generated RPC signature" call `gm.ts` already makes for `GmChatMessage`. */
export interface GmCheck {
  id: string
  ability: string
  dc: number
  advantage: Advantage | null
  stakes: string | null
  status: CheckStatus
  character_id: string | null
  session_id: string | null
  created_at: string
  resolved_at: string | null
  resolved_total: number | null
  resolved_roll: number | null
  resolved_source: ResolveSource | null
  resolved_band: CheckBand | null
}

/** `resolve_check`'s own return shape (see its `RETURNS jsonb` body: a
 * single `jsonb_build_object(...)`, not a table row) — a fresh read of
 * the outcome the RPC itself just decided, not an echo of the `gm_checks`
 * row. `roll` is null for a physical resolution (no server die was ever
 * rolled). */
export interface ResolveCheckResult {
  total: number
  roll: number | null
  modifier: number
  source: ResolveSource
  band: CheckBand
  band_index: number
}

/** Every check in the campaign, oldest first — same ordering convention
 * `listJournalEntries` already uses, since check cards interleave with
 * journal entries in the merged feed (`lib/feed.ts`) by `created_at`.
 * `gm_list_checks` itself doesn't guarantee an order, so this sorts
 * client-side rather than trusting one. */
export async function listChecks(campaignId: string): Promise<GmCheck[]> {
  const { data, error } = await supabase.rpc('gm_list_checks', { p_campaign_id: campaignId })
  if (error) throw error
  return ((data ?? []) as unknown as GmCheck[])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

/** Wraps `resolve_check`. `source: 'server'` lets the database roll (d20
 * plus advantage/disadvantage plus the character's ability modifier, all
 * server-side); `source: 'physical'` requires `total` — the number the
 * player rolled at the table. Either path is a single RPC call and, on
 * success, the database has already written the revealed band's
 * narration to the journal and applied any `hp_delta` — this function
 * only returns what the check itself resolved to, not those side
 * effects; callers refetch entries/characters to see them (see
 * `useGmJournalHandlers.handleResolveCheck`). Throws on failure (a
 * double-resolve, a non-member, a missing total for a physical
 * resolution) — same throw-on-error contract as `lib/campaigns.ts`'s
 * other command wrappers, unlike `askGm`'s deliberate never-rejects. */
export async function resolveCheck(
  checkId: string,
  source: ResolveSource,
  total?: number,
): Promise<ResolveCheckResult> {
  const { data, error } = await supabase.rpc('resolve_check', {
    p_check_id: checkId,
    p_source: source,
    p_total: total,
  })
  if (error) throw error
  return data as unknown as ResolveCheckResult
}
