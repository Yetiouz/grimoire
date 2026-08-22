// lib/rules/types.ts
//
// The multi-system seam for character creation (BUILD_PLAN.md's "Game
// system pack" concept, cashed in for the second time — the AI GM
// already has one of these, keyed by `campaigns.system` against the
// `system_packs` table for persona/rules PROSE; see
// `supabase/functions/gm_turn/index.ts`'s own comment: "Mork Borg is an
// INSERT"). This is the same idea for structured character-creation
// data instead of prose: a `RulesModule` per game system, registered by
// id in `./index.ts`. `CharacterBuilder.tsx` never hardcodes Shadowdark
// — it asks whichever module a campaign's `system` resolves to what
// steps/tables exist, and renders whatever that module returns. Adding
// Mork Borg later is a new file conforming to this shape, not a rewrite
// of the wizard.
//
// Deliberately thin: only what a *creation* wizard needs (stat method,
// ancestries, classes, background tables, alignments, starting gear,
// AC/HP formulas). Leveling-up data (spells-known-by-level, HP-die
// progression past 1st level, titles past 1-2) is out of scope here,
// same "leveling is a separate concern" line 0009_character_commands.sql
// already draws for `adjust_character_xp` — a future level-up flow can
// extend `RulesModule` when it exists; nothing here blocks that.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export const ABILITY_ORDER: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export interface RulesAncestry {
  key: string
  name: string
  /** Prose, not a fixed list of talent effects — matches how every
   * imported character's `sheet.attacks_talents` already stores talent
   * text as free-form strings rather than structured bonuses. */
  languages: string[]
  talent: string
  /** Extra 1st-level class-talent-table rolls this ancestry grants on
   * top of the class's own one roll (rulebook pg. 14) — e.g. Human's
   * "Ambitious: you gain one additional talent roll at 1st level."
   * Absent/0 for every ancestry that doesn't grant one. Was previously
   * un-structured (the bonus only existed as prose in `talent`, so the
   * builder's talent-roll UI never actually granted it) — a visual
   * review caught the gap, 2026-08-11. */
  bonusTalentRolls?: number
}

export interface RulesTalentTableRow {
  /** The 2d6 range this row covers, as printed ("2", "3-6", "12", ...) —
   * kept as a string rather than a {min,max} pair since a few rows have
   * annotations in the same cell ("2 duplicate = reroll") that a numeric
   * range can't carry without a second field nobody else needs. */
  roll: string
  effect: string
}

/** One tier-1 spell a class can choose at character creation.
 * `description` is the spell's effect, condensed from the sourcebook's
 * own Duration/Range/effect block into a sentence or two of prose (the
 * mechanical Duration/Range labels are dropped, not the mechanics
 * themselves) — same "prose, not a stat block" treatment
 * `RulesClass.features` already gives class features. 2026-08-22
 * (owner: "so the spell list needs a spell and then what that spell
 * does") — added alongside the name once every spellcasting class's
 * list carried real ones rather than requiring a click-through. */
export interface RulesSpell {
  name: string
  description: string
}

export interface RulesSpellcasting {
  ability: Ability
  /** How many tier-1 spells this class knows at 1st level — 0-level
   * characters never reach this (no class chosen yet), so this only
   * matters once Class is picked in the 1st-level path. */
  knownAtLevel1: number
  /** Null when the sourcebook's full tier-1 list wasn't transcribed
   * into this module. The builder falls back to free-text spell-name
   * entry in that case, same shape `sheet.spells` already stores today
   * — never a fabricated list standing in for the book's real one.
   * (As of 2026-08-22 every spellcasting class in this module — Priest,
   * Wizard, Witch, Seer — has its real tier-1 list transcribed, so this
   * only matters for a future class added without one yet.) */
  spellList: RulesSpell[] | null
}

export interface RulesClass {
  key: string
  name: string
  /** Which book this comes from, shown as a badge in the Class step. */
  source: 'Core' | 'Diablerie' | 'Red Sands' | 'Midnight Sun'
  blurb: string
  weapons: string
  armor: string
  hpDie: number
  /** Every ability this class's own talent table names as a "+2 to X
   * stat" option (e.g. Fighter's "+2 to Strength, Dexterity, or
   * Constitution stat" row), in the order the rulebook prints them —
   * with `spellcasting.ability` moved first when the class has one,
   * since that's the one stat the class is definitionally built around
   * rather than just optionally good at. Owner request, 2026-08-15
   * ("I may want a strength or dex class") — a scan aid for the Class
   * step grid, not a new rule; every value here is already printed
   * somewhere in that class's own transcribed talent table/spellcasting
   * field, nothing invented. Left empty for a class whose talent table
   * only ever says "two stats" without naming which ones (Warlock,
   * Cursed Scroll 1 pg. 18 — "Add +1 point to two stats, they must be
   * different") — same never-fabricate discipline `spellList: null`
   * already follows elsewhere in this file, rather than guessing at a
   * thematic stat the book itself doesn't commit to. */
  primaryAbilities: Ability[]
  /** Non-talent-roll features every member of the class starts with —
   * Deity choice, Turn Undead, Familiar, Mount, and so on. Prose, same
   * reasoning as `RulesAncestry.talent`. */
  features: string[]
  /** The class's 2d6 talent-roll table — 1st-level characters get one
   * roll on this per the rulebook ("One class talent roll" pg. 14). */
  talentTable: RulesTalentTableRow[]
  spellcasting?: RulesSpellcasting
  /** Level 1-2 title only (see module doc comment — leveling-tier
   * titles are out of scope for a creation wizard). Absent for classes
   * whose title table wasn't transcribed. */
  titleAtLevel1?: { lawful: string; chaotic: string; neutral: string }
  /** True only for Priest — "choose a god to serve who matches your
   * alignment" (rulebook pg. 20). Drives whether the Background/
   * Alignment step also shows a deity picker; every other class leaves
   * this unset rather than false, since "does this class have a deity
   * requirement" isn't a question that applies to it at all. */
  requiresDeity?: boolean
}

export interface RulesBackgroundEntry {
  roll: number
  name: string
  detail: string
}

export interface RulesBackgroundTable {
  key: string
  label: string
  /** Which classes/campaigns this table is themed for — shown as the
   * default table for those, but every table is selectable regardless
   * (a Diabolical background reads fine on a core Fighter). */
  entries: RulesBackgroundEntry[]
}

export interface RulesDeity {
  name: string
  alignment: 'Lawful' | 'Neutral' | 'Chaotic'
  blurb: string
}

export interface RulesAlignment {
  key: 'Lawful' | 'Neutral' | 'Chaotic'
  blurb: string
}

export interface RulesGearRoll {
  roll: number
  item: string
}

export interface RulesModule {
  id: string
  label: string
  statMethod: {
    /** "3d6" — the formula rolled per stat, in order. */
    formula: string
    order: Ability[]
    /** Shown as a banner when eligible ("nothing's 14+"). Null for a
     * system with no such rule. */
    rerollRule: string | null
  }
  abilityModifierTable: { min: number; max: number; mod: number }[]
  ancestries: RulesAncestry[]
  classes: RulesClass[]
  backgroundTables: RulesBackgroundTable[]
  alignments: RulesAlignment[]
  deities: RulesDeity[]
  /** "10 + DEX mod" — shown as help text; the builder still computes it
   * directly rather than parsing this string. */
  acFormula: string
  supportsZeroLevel: boolean
  zeroLevelGear: { rollCount: string; table: RulesGearRoll[] }
  firstLevelGoldFormula: string
}

export function abilityModifier(module: RulesModule, score: number): number {
  const row = module.abilityModifierTable.find((r) => score >= r.min && score <= r.max)
  return row ? row.mod : 0
}
