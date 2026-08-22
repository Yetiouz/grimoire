// lib/rules/index.ts
//
// Registry for the multi-system seam (see ./types.ts's doc comment) —
// keyed by `campaigns.system`, same convention the AI GM's
// `system_packs` table already uses. Adding Mork Borg later means a new
// `lib/rules/morkborg.ts` conforming to `RulesModule` and one more line
// in this map; nothing that calls `getRulesModule` needs to change.

import type { RulesModule } from './types'
import { SHADOWDARK } from './shadowdark'
import { CORE_EQUIPMENT } from './equipment'
import type { RulesEquipmentItem } from './equipment'
import { CYBORG_EQUIPMENT } from './cyborgEquipment'

export type { RulesModule, RulesClass, RulesAncestry, RulesBackgroundTable, RulesTalentTableRow, RulesSpell, Ability } from './types'
export { abilityModifier, ABILITY_ORDER } from './types'

const RULES_BY_SYSTEM: Record<string, RulesModule> = {
  shadowdark: SHADOWDARK,
}

/** Falls back to Shadowdark for an unrecognized/missing system id
 * rather than throwing — every campaign in this app predates the
 * `system` column having more than one real value, so a defensive
 * fallback here is cheaper than a crash on old data. */
export function getRulesModule(system: string | null | undefined): RulesModule {
  return (system && RULES_BY_SYSTEM[system]) || SHADOWDARK
}

/** Whether a REAL module exists for this system id — distinct from
 * `getRulesModule`, whose defensive Shadowdark fallback is right for
 * read paths (old campaigns predate the column) but WRONG for the
 * Character Builder: a CY_BORG campaign falling back to the Shadowdark
 * wizard would build a fantasy adventurer into a cyberpunk party
 * (owner, 2026-08-17: "all the Shadowdark stuff is not in the CY_BORG
 * campaign"). Callers that would present another system's content use
 * this to gate instead. */
export function hasRulesModule(system: string | null | undefined): boolean {
  return Boolean(system && RULES_BY_SYSTEM[system])
}

/** Per-system display language (owner, 2026-08-17: "separate games
 * using same interface") — the shared components stay one interface,
 * but every label that would misname another game's concept comes from
 * here instead of being hardcoded Shadowdark. CY_BORG has no AC (armor
 * TIERS), no gold (¤ credits), no luck tokens (GLITCHES), no XP/levels
 * (improvement is diegetic), and five −3..+3 abilities instead of six
 * scored ones. Falls back to Shadowdark labels for unknown/old
 * systems, same posture as every other read in this file. */
export interface SystemDisplay {
  /** Vitals labels: full (sheet tiles) and short (party-card spans). */
  acLabel: string
  acShort: string
  moneyLabel: string
  moneyShort: string
  luckLabel: string
  luckShort: string
  /** Format the gold jsonb for display ("20 gp 4 sp" vs "100¤"). */
  formatMoney: (gold: { gp?: number; sp?: number; cp?: number }) => string
  /** Whether XP + character level are real concepts in this system. */
  showProgression: boolean
  /** Non-null replaces the Shadowdark six in the sheet's Abilities
   * grid: this system's ability list, rendered mod-only (−3..+3). */
  abilities: Array<{ key: string; label: string }> | null
}

const SHADOWDARK_DISPLAY: SystemDisplay = {
  acLabel: 'AC', acShort: 'AC',
  moneyLabel: 'Gold', moneyShort: 'GP',
  luckLabel: 'Luck', luckShort: 'LUCK',
  formatMoney: (gold) => {
    const parts: string[] = []
    if (gold.gp) parts.push(`${gold.gp} gp`)
    if (gold.sp) parts.push(`${gold.sp} sp`)
    if (gold.cp) parts.push(`${gold.cp} cp`)
    return parts.length > 0 ? parts.join(' ') : '0 gp'
  },
  showProgression: true,
  abilities: null,
}

const CYBORG_DISPLAY: SystemDisplay = {
  acLabel: 'Armor', acShort: 'ARM',
  moneyLabel: '¤', moneyShort: '¤',
  luckLabel: 'Glitches', luckShort: 'GLITCH',
  formatMoney: (gold) => `${(gold.gp ?? 0).toLocaleString()}¤`,
  showProgression: false,
  abilities: [
    { key: 'agility', label: 'AGI' },
    { key: 'knowledge', label: 'KNO' },
    { key: 'presence', label: 'PRE' },
    { key: 'strength', label: 'STR' },
    { key: 'toughness', label: 'TOU' },
  ],
}

export function getSystemDisplay(system: string | null | undefined): SystemDisplay {
  return system === 'cyborg' ? CYBORG_DISPLAY : SHADOWDARK_DISPLAY
}

/** The shop catalog for a campaign's system — `campaigns.system` IS the
 * owner's requested "toggle". CY_BORG prices are ¤ (credits) riding the
 * costCp field at ¤ ≡ gp (see cyborgEquipment.ts's header); `currency`
 * tells the Shop how to render money. Unknown/old systems get the
 * Shadowdark Core list, same fallback posture as `getRulesModule`. */
export function getShopCatalog(system: string | null | undefined): { items: RulesEquipmentItem[]; currency: 'coins' | 'credits' } {
  if (system === 'cyborg') return { items: CYBORG_EQUIPMENT, currency: 'credits' }
  return { items: CORE_EQUIPMENT, currency: 'coins' }
}
