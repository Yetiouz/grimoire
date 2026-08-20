import { supabase } from './supabase'
import type { Json, Tables } from './database.types'

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

// ── Character commands (BUILD_PLAN.md slice 6) ──────────────────────
// Every wrapper here takes an optional `sessionId` — passed straight
// through as `p_session_id` — so the command can echo a `system`-kind
// journal entry when the caller is inside an open session. The command
// itself still runs with no session open (GM bookkeeping between
// sessions is a real case), it just skips the log line in that case;
// see 0009_character_commands.sql's header comment for the full
// reasoning. Every wrapper returns the updated `characters` row, same
// "echo what the RPC returned" shape as `startSession`/`endSession`.

export async function adjustCharacterHp(
  characterId: string,
  delta: number,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('adjust_character_hp', {
    p_character_id: characterId,
    p_delta: delta,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** Corrects `hp_max` after creation (migration 0030) -- the only field
 * `CharacterBuilder`'s wizard can leave un-rolled with no way to fix it
 * in-app: "Roll HP" sits on the Review step as an optional button, and
 * nothing gates Create on having clicked it, so a character can be
 * created at the un-rolled floor value. `adjust_character_hp` only
 * moves `hp_current` within [0, hp_max]; this is the companion command
 * for hp_max itself. Clamps `hp_current` down if it now exceeds the
 * new max server-side -- never bumps it up, same no-free-healing rule
 * `adjust_character_hp` already follows. */
export async function setCharacterHpMax(
  characterId: string,
  hpMax: number,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('set_character_hp_max', {
    p_character_id: characterId,
    p_hp_max: hpMax,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

// ── Dying, stabilizing (migration 0035, encounter mode phase 3) ─────
// `death_timer_rounds` itself is set/cleared entirely inside
// `adjust_character_hp` (see that migration's own doc comment) --
// nothing here writes it directly. These two commands are the two
// things that can happen ON a dying character's own turn or an ally's:
// resolve the death-timer roll, or attempt to stop it early.

/** Wraps `resolve_dying_turn` -- called once per the dying character's
 * own turn (rulebook p.89: roll a d20 each turn while dying; natural
 * 20 rises with 1 HP, some talents widen that range -- see the
 * migration's own comment on how it reads the character's sheet text
 * for "Last Stand" rather than hardcoding a class). Throws server-side
 * if the character isn't currently dying (`death_timer_rounds` null).
 * The returned character reflects whichever of the three outcomes
 * happened -- rose (hp_current 1, timer null), still dying (timer
 * decremented), or perished (status 'dead', timer 0) -- there's no
 * separate flag to read; compare against the character passed in if
 * the caller needs to know which branch fired. */
export async function resolveDyingTurn(characterId: string, sessionId?: string | null): Promise<Character> {
  const { data, error } = await supabase.rpc('resolve_dying_turn', {
    p_character_id: characterId,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** A dying-turn roll, resolved -- distinct from `Character` since a
 * failed check is a real, meaningful outcome with nothing to echo back
 * on the row (see `resolve_stabilize_check`'s own doc comment). */
export interface StabilizeCheckResult {
  success: boolean
  roll: number
  dc: number
  character: Character
}

/** Wraps `resolve_stabilize_check` -- one ally attempts a DC 15 INT
 * check (rulebook p.89, "at Close range") to stop a dying character's
 * timer early. `helperCharacterId` is who's attempting it, not the
 * caller's own identity -- any campaign member can call this for any
 * two characters in their campaign, matching `adjustCharacterHp`'s own
 * permissive trust model. Throws server-side if the target isn't
 * dying. On success the timer clears (still unconscious, no longer at
 * risk); on failure nothing about the target changes -- `success` is
 * the only way to tell which happened, the row's own `death_timer_rounds`
 * won't have moved either way you need to check it. */
export async function resolveStabilizeCheck(
  characterId: string,
  helperCharacterId: string,
  sessionId?: string | null,
): Promise<StabilizeCheckResult> {
  const { data, error } = await supabase.rpc('resolve_stabilize_check', {
    p_character_id: characterId,
    p_helper_character_id: helperCharacterId,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data as unknown as StabilizeCheckResult
}

export async function adjustCharacterXp(
  characterId: string,
  delta: number,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('adjust_character_xp', {
    p_character_id: characterId,
    p_delta: delta,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** Adjusts `luck_tokens` (migration 0022) — the GM-awarded reroll
 * currency (rulebook p.79: normally capped at one per player, uncapped
 * under Pulp Mode). Same shape as `adjustCharacterXp`: floors at 0
 * server-side, no hard ceiling here — this app has no structured
 * modes-of-play column to key a cap off of, so enforcing the
 * normal-vs-Pulp cap is left to the GM, same trust model every other
 * command already uses. */
export async function adjustCharacterLuck(
  characterId: string,
  delta: number,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('adjust_character_luck', {
    p_character_id: characterId,
    p_delta: delta,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

export async function adjustCharacterGold(
  characterId: string,
  delta: { gp?: number; sp?: number; cp?: number },
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('adjust_character_gold', {
    p_character_id: characterId,
    p_gp: delta.gp ?? 0,
    p_sp: delta.sp ?? 0,
    p_cp: delta.cp ?? 0,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** Adds one item to `sheet.equipment`, incrementing `gear_current` by
 * one slot in the same call (linked, per the confirmed gear-model
 * decision — one item costs one slot). Throws server-side if
 * `gear_max` is set and already full. */
export async function addCharacterGear(
  characterId: string,
  itemName: string,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('add_character_gear', {
    p_character_id: characterId,
    p_item_name: itemName,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** Removes the equipment-array entry at `itemIndex` (the array's real,
 * zero-based index — not a name match, since duplicate item names like
 * two "Torch" entries are plausible in the imported data), freeing one
 * gear slot in the same call. */
export async function removeCharacterGear(
  characterId: string,
  itemIndex: number,
  sessionId?: string | null,
): Promise<Character> {
  const { data, error } = await supabase.rpc('remove_character_gear', {
    p_character_id: characterId,
    p_item_index: itemIndex,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

/** Restores `hp_current` to `hp_max`. Nothing else in the schema today
 * (spell slots, per-day talent uses) is a tracked resource a rest could
 * clear, so this only touches HP rather than inventing fields to reset. */
export async function restCharacter(characterId: string, sessionId?: string | null): Promise<Character> {
  const { data, error } = await supabase.rpc('rest_character', {
    p_character_id: characterId,
    p_session_id: sessionId ?? undefined,
  })
  if (error) throw error
  return data
}

// ── Character creation (BUILD_PLAN.md slice 12) ─────────────────────
// `create_character` (migration 0021) is the creation half of the
// commands above — every one of those mutates an existing row; nothing
// before this migration could ever produce the row itself outside of
// 0004's one-time Black Road import. Deliberately NOT rules-aware, same
// as this whole file: `CharacterBuilder.tsx` (via `lib/rules/`) does
// every Shadowdark-specific computation (stats, HP, AC, starting gear)
// client-side and this wrapper just writes the final values, exactly
// the "trust the client's roll" shape every other command here already
// takes. `gearCurrent` is NOT a param — the RPC derives it from
// `sheet.equipment`'s length itself, same linked-counter invariant
// `addCharacterGear`/`removeCharacterGear` maintain going forward.

export interface CreateCharacterInput {
  campaignId: string
  name: string
  /** Composed by the caller as "{Ancestry} {Class}" (or "{Ancestry}
   * (0-level)" pre-class) — matches how Kimbo/Constantine/LaLa are
   * already stored; ancestry has no column of its own (see `lib/rules/`
   * doc comments for why). */
  classTitle: string
  hpMax: number
  ac: number
  level?: number
  memberId?: string | null
  background?: string | null
  /** Composed by the caller as "{Alignment} {Title}" (e.g. "Neutral
   * Seeker") when a title is known, or just the bare alignment word for
   * a 0-level character — matches the existing imported rows exactly. */
  alignmentTitle?: string | null
  xpNeeded?: number | null
  gearMax?: number | null
  gold?: CharacterGold
  abilities?: CharacterAbilities
  sheet?: CharacterSheetData
  status?: string
  color?: string | null
  sessionId?: string | null
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const { data, error } = await supabase.rpc('create_character', {
    p_campaign_id: input.campaignId,
    p_name: input.name,
    p_class_title: input.classTitle,
    p_hp_max: input.hpMax,
    p_ac: input.ac,
    p_level: input.level ?? 1,
    p_member_id: input.memberId ?? undefined,
    p_background: input.background ?? undefined,
    p_alignment_title: input.alignmentTitle ?? undefined,
    p_xp_needed: input.xpNeeded ?? undefined,
    p_gear_max: input.gearMax ?? undefined,
    // `as unknown as Json` on the three jsonb args: the generated RPC
    // types accept the closed `Json` union, and our richer interfaces
    // (CharacterGold etc.) are JSON-shaped but not assignable to a
    // closed union by TS's rules. The cast states what's already true
    // at runtime. (CI's tsc failed on these for a stretch of commits —
    // part of the 2026-08-15 make-CI-green pass.)
    p_gold: (input.gold ?? {}) as unknown as Json,
    p_abilities: (input.abilities ?? {}) as unknown as Json,
    p_sheet: (input.sheet ?? {}) as unknown as Json,
    p_status: input.status ?? 'active',
    p_color: input.color ?? undefined,
    p_session_id: input.sessionId ?? undefined,
  })
  if (error) throw error
  return data
}
