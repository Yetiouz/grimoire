import { supabase } from './supabase'
import type { SceneZone } from './maps'
import type { Tables } from './database.types'

export type EncounterMonster = Tables<'encounter_monsters'>
export type TurnOrder = Tables<'turn_order'>

/** `encounter_monsters.zone` reuses the exact same close/near/far check
 * constraint as `scene_positions.zone` (migration `0031_encounter_mode`'s
 * own doc comment) -- the same client-side-mirror type, not a
 * lookalike redefined here, since it really is the same rulebook
 * Close/Near/Far concept both tables encode. */
export type EncounterZone = SceneZone

export type CombatantType = 'character' | 'monster'

/** One entry in `turn_order.combatants` -- a real, ordered jsonb array
 * written exclusively by `roll_initiative`/`advance_turn` (see that
 * migration's own doc comment), never hand-edited client-side. Matches
 * the shape those RPCs build server-side exactly. */
export interface Combatant {
  combatant_type: CombatantType
  combatant_id: string
  label: string
  initiative_roll: number
  acted: boolean
  moved: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Safe reader for `turn_order.combatants` -- same "missing/malformed
 * reads as nothing present, never fabricated" convention
 * `readCharacterSheet`/`readCharacterGold` already established in
 * `lib/characters.ts`. A brand-new `turn_order` row (just after
 * `start_encounter`, before the first `roll_initiative`) has an empty
 * array, not a missing one, so this only ever guards against the
 * genuinely unexpected case. */
export function readCombatants(combatants: TurnOrder['combatants']): Combatant[] {
  return Array.isArray(combatants) ? (combatants as unknown as Combatant[]) : []
}

/** Same ac/hp_max/hp_current/attacks/notes shape `npcs.stat_block`
 * already established, plus `dex_mod` -- the one field this feature
 * needs that npcs never did (see migration `0031_encounter_mode`'s own
 * doc comment on why). Reader shape mirrors `readCharacterSheet`. */
export interface MonsterStatBlock {
  ac?: number
  hp_max?: number
  hp_current?: number
  attacks?: string[]
  notes?: string
  dex_mod?: number
}

export function readMonsterStatBlock(statBlock: EncounterMonster['stat_block']): MonsterStatBlock {
  return isPlainObject(statBlock) ? (statBlock as MonsterStatBlock) : {}
}

// -- Encounter mode (BUILD_PLAN.md item 13, phase 1: 2026-08-14 migration
// `0031_encounter_mode.sql`; phase 2 UI: same day) -----------------------
// Monsters + initiative + turn order. See
// `grimoire-phase19-encounter-mode-scope.md` (this project) for the full
// scope and the phased build order this file's phase-1 wrappers close
// out.

/** Every monster currently in this campaign's encounter -- RLS already
 * narrows this to visible-to-players rows for a non-owner caller (the
 * `encounter_monsters_select_member` policy), so a player's own fetch
 * here naturally comes back shorter than the GM's, no client-side
 * filtering needed. Ephemeral: empty once no encounter is running (see
 * `endEncounter` below). */
export async function listEncounterMonsters(campaignId: string): Promise<EncounterMonster[]> {
  const { data, error } = await supabase
    .from('encounter_monsters')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** This campaign's turn order, if an encounter is running -- `null`
 * otherwise (no row exists between encounters; `end_encounter` deletes
 * it). `maybeSingle`, not `single`: no active encounter is the expected
 * steady state, not an error, same reasoning `getPartyPosition` already
 * uses for its own one-row-or-none table. */
export async function getTurnOrder(campaignId: string): Promise<TurnOrder | null> {
  const { data, error } = await supabase.from('turn_order').select('*').eq('campaign_id', campaignId).maybeSingle()
  if (error) throw error
  return data
}

/** Wraps `start_encounter` -- GM-only. Opens (or resets, if one was
 * already running) a blank turn order for this campaign; monsters are
 * added separately via `addEncounterMonster` and initiative is rolled
 * separately via `rollInitiative`, matching the RPC's own "one command
 * per concern" shape. */
export async function startEncounter(campaignId: string): Promise<TurnOrder> {
  const { data, error } = await supabase.rpc('start_encounter', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

export interface AddEncounterMonsterInput {
  label: string
  statBlock?: MonsterStatBlock
  zone?: EncounterZone
}

/** Wraps `add_encounter_monster` -- GM-only. `zone` defaults to `'near'`
 * server-side (the column default) when omitted, same convention
 * `addMapMarker`'s `markerKind` already follows for its own
 * server-defaulted field. */
export async function addEncounterMonster(campaignId: string, input: AddEncounterMonsterInput): Promise<EncounterMonster> {
  const { data, error } = await supabase.rpc('add_encounter_monster', {
    p_campaign_id: campaignId,
    p_label: input.label,
    p_stat_block: input.statBlock ?? {},
    p_zone: input.zone ?? undefined,
  })
  if (error) throw error
  return data
}

/** Wraps `damage_encounter_monster` -- GM-only. Same floor-at-0/ceiling-
 * at-hp_max, no-free-healing-past-max shape as `adjustCharacterHp`;
 * negative `delta` damages, positive heals. Throws server-side if the
 * monster has no `hp_max` set yet (see that RPC's own doc comment). */
export async function damageEncounterMonster(monsterId: string, delta: number): Promise<EncounterMonster> {
  const { data, error } = await supabase.rpc('damage_encounter_monster', {
    p_monster_id: monsterId,
    p_delta: delta,
  })
  if (error) throw error
  return data
}

export interface SetMonsterVisibilityInput {
  visibleToPlayers?: boolean
  hpVisibleToPlayers?: boolean
}

/** Wraps `set_monster_visibility` -- GM-only. Either flag can be flipped
 * independently; omitting one leaves it unchanged server-side
 * (`coalesce`), same partial-update convention `setPartyPosition`/
 * `updateMapMarker` already use. */
export async function setMonsterVisibility(monsterId: string, input: SetMonsterVisibilityInput): Promise<EncounterMonster> {
  const { data, error } = await supabase.rpc('set_monster_visibility', {
    p_monster_id: monsterId,
    p_visible_to_players: input.visibleToPlayers ?? undefined,
    p_hp_visible_to_players: input.hpVisibleToPlayers ?? undefined,
  })
  if (error) throw error
  return data
}

/** Wraps `roll_initiative` -- GM-only. Rolls 1d20+DEX for every active
 * character plus one shared 1d20+highest-monster-DEX roll for every
 * monster present (rulebook pg. 83), replacing whatever turn order
 * already existed. Re-rollable -- calling this again (e.g. after a
 * surprise round) fully replaces the prior order, matching the RPC's
 * own doc comment. */
export async function rollInitiative(campaignId: string): Promise<TurnOrder> {
  const { data, error } = await supabase.rpc('roll_initiative', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

/** Wraps `advance_turn` -- GM-only. Clockwise rotation without
 * re-sorting; wraps to the top and bumps `round_number` when it runs off
 * the end. */
export async function advanceTurn(campaignId: string): Promise<TurnOrder> {
  const { data, error } = await supabase.rpc('advance_turn', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

/** Wraps `end_encounter` -- GM-only. Logs a short journal-feed summary
 * of the fight when `sessionId` is provided (an open session), then
 * deletes every `encounter_monsters` row and the `turn_order` row --
 * ephemeral by design (decision #2, scope doc). Same optional-session
 * convention `setCharacterHpMax`/`adjustCharacterHp` already use. */
export async function endEncounter(campaignId: string, sessionId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('end_encounter', {
    p_campaign_id: campaignId,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
}
