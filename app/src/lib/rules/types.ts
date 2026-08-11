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
}

export interface RulesTalentTableRow {
  /** The 2d6 range this row covers, as printed ("2", "3-6", "12", ...) —
   * kept as a string rather than a {min,max} pair since a few rows have
   * annotations in the same cell ("2 duplicate = reroll") that a numeric
   * range can't carry without a second field nobody else needs. */
  roll: string
  effect: string
}

export interface RulesSpellcasting {
  ability: Ability
  /** How many tier-1 spells this class knows at 1st level — 0-level
   * characters never reach this (no class chosen yet), so this only
   * matters once Class is picked in the 1st-level path. */
  knownAtLevel1: number
  /** Null when the sourcebook's full tier-1 list wasn't transcribed
   * into this module (Witch/Warlock — Diablerie pg. 24's witch spell
   * list wasn't pulled in whole; LaLa's three known spells are real
   * data but not confirmed as the *complete* tier-1 option set). The
   * builder falls back to free-text spell-name entry in that case,
   * same shape `sheet.spells` already stores today — never a fabricated
   * list standing in for the book's real one. */
  spellList: string[] | null
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
