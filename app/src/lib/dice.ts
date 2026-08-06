import { supabase } from './supabase'

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/** Shape of the `roll_dice` command's jsonb return. `rolls` is the kept
 * set (the only set, in normal mode); `otherRolls` is the discarded set
 * on advantage/disadvantage, null otherwise. */
export interface DiceRollResult {
  die: DieType
  count: number
  mode: RollMode
  rolls: number[]
  otherRolls: number[] | null
  total: number
}

/** Wraps the `roll_dice` command (BUILD_PLAN.md slice 4: server-
 * authoritative dice) — results come from Postgres's own random()
 * server-side specifically so they can't be faked or replayed by the
 * client. A pure RNG primitive: it doesn't know about modifiers and
 * doesn't write to the journal itself — callers compose the display
 * text (see `formatRollText`) and log it through the existing
 * `logJournalEntry` themselves, same as any hand-typed entry. */
export async function rollDice(campaignId: string, die: DieType, count: number, mode: RollMode): Promise<DiceRollResult> {
  const { data, error } = await supabase.rpc('roll_dice', {
    p_campaign_id: campaignId,
    p_die: die,
    p_count: count,
    p_mode: mode,
  })
  if (error) throw error
  return data as unknown as DiceRollResult
}

/** A modifier applied on top of a roll — deliberately not tied to
 * `CharacterAbilities` here, since "Custom" (a free-typed number) is
 * just as valid a source as an ability score. `label` is what shows in
 * the logged text, e.g. "STR Modifier" or "Custom". */
export interface RollModifier {
  value: number
  label: string
}

/**
 * Renders a roll (plus an optional modifier) into the exact journal-log
 * format the user asked for: the raw dice result first, the modifier
 * after — "10 + 2 (STR Modifier) = 12" — rather than leading with the
 * final total. No modifier phrase at all when there isn't one, matching
 * `player-view-mockup.html`'s own inline roll display
 * (`2d20 kept 18 +3 → 21 vs AC 13`) for the dice-notation part:
 * advantage/disadvantage always rolled two full sets, so the notation
 * doubles the die count ("2d20 kept 18" for a single d20 check at
 * advantage, "4d6 kept 15" for 2d6 at advantage).
 *
 * Whenever more than one physical die is actually rolled — count > 1 in
 * normal mode, or ANY advantage/disadvantage roll (always two full
 * sets, even at count 1) — the individual dice are spelled out in
 * brackets rather than just the sum, per the user's explicit ask to see
 * each rolled number, not just a total. Advantage/disadvantage also
 * shows the discarded set (`vs [...]`) so it's clear which set actually
 * got kept. A single die in normal mode skips the brackets entirely
 * (`d20 10`, not `d20 [10] = 10`) — nothing to break out there.
 */
export function formatRollText(result: DiceRollResult, modifier?: RollModifier): string {
  const notation =
    result.mode === 'normal'
      ? result.count > 1
        ? `${result.count}${result.die}`
        : result.die
      : `${result.count * 2}${result.die}`

  const showsIndividualRolls = result.count > 1 || result.mode !== 'normal'
  let rollPart: string
  if (!showsIndividualRolls) {
    rollPart = `${notation} ${result.total}`
  } else if (result.mode === 'normal') {
    rollPart = `${notation} [${result.rolls.join(', ')}] = ${result.total}`
  } else {
    const otherText = result.otherRolls ? ` vs [${result.otherRolls.join(', ')}]` : ''
    rollPart = `${notation} [${result.rolls.join(', ')}]${otherText} kept ${result.total}`
  }

  if (!modifier || modifier.value === 0) return rollPart

  const sign = modifier.value > 0 ? '+' : '−'
  const total = result.total + modifier.value
  return `${rollPart} ${sign}${Math.abs(modifier.value)} (${modifier.label}) = ${total}`
}
