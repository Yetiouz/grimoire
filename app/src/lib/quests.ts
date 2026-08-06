import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Quest = Tables<'quests'>

/** Quests in a campaign, ordered by `sort_order` (ascending) — the same
 * order the source `quest-log.md`/`tracker.xlsx` used, not title or
 * created-at. RLS already scopes this to membership, same as every
 * other campaign-scoped read in this kit.
 *
 * Read-only for this pass, matching CharacterSheet's own "view first"
 * precedent (BUILD_PLAN.md slice 3): the real imported quest data
 * (7 quests) has a title, one freeform `status` string, one `goal`
 * line, and an optional `claimant` name — plenty to build a real Quest
 * Log view from. A status/claimant-update command is a real, separate
 * follow-up (would need a new `SECURITY DEFINER` command, since
 * `quests` currently has no write policy at all) — not built here
 * since nothing in this pass needs to mutate it yet. */
export async function listQuests(campaignId: string): Promise<Quest[]> {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
