import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Character = Tables<'characters'>

/** Characters in a campaign — active party members and `awaiting` PCs
 * alike (BUILD_PLAN.md slice 3's resolved open question: awaiting PCs
 * render dimmed on PlayerCard, not filtered out here). RLS already
 * scopes this to membership, same as every other campaign-scoped read
 * in `campaigns.ts`. */
export async function listCharacters(campaignId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export interface CharacterGold {
  gp?: number
  sp?: number
  cp?: number
}

export interface AbilityScore {
  score: number
  mod: number
}

export interface CharacterAbilities {
  str?: AbilityScore
  dex?: AbilityScore
  con?: AbilityScore
  int?: AbilityScore
  wis?: AbilityScore
  cha?: AbilityScore
}

/** The known-but-optional keys seen across the three imported sheets
 * (Kimbo, Constantine, LaLa) — each carries a different subset (Kimbo
 * has `covenant_duties`, LaLa has `familiar`, only Kimbo and LaLa have
 * `spells`) since `characters.sheet` is jsonb by design (BUILD_PLAN.md's
 * multi-system seam), not a fixed column set. Nothing here is assumed
 * present. */
export interface CharacterSheetData {
  attacks_talents?: string[]
  active_blessing?: string
  covenant_duties?: string[]
  spells?: string[]
  equipment?: string[]
  languages?: string[]
  appearance?: string
  personal_revelation?: string
  familiar?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Safe, typed readers for the three jsonb columns (`gold`, `abilities`,
 * `sheet`) — the database type generator can only say `Json`, not the
 * actual shape, so components read through these rather than casting
 * ad hoc at each call site. Missing/malformed data reads as "nothing
 * present," never fabricated. */
export function readCharacterGold(gold: Character['gold']): CharacterGold {
  return isPlainObject(gold) ? (gold as CharacterGold) : {}
}

export function readCharacterAbilities(abilities: Character['abilities']): CharacterAbilities {
  return isPlainObject(abilities) ? (abilities as CharacterAbilities) : {}
}

export function readCharacterSheet(sheet: Character['sheet']): CharacterSheetData {
  return isPlainObject(sheet) ? (sheet as CharacterSheetData) : {}
}
