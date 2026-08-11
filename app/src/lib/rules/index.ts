// lib/rules/index.ts
//
// Registry for the multi-system seam (see ./types.ts's doc comment) —
// keyed by `campaigns.system`, same convention the AI GM's
// `system_packs` table already uses. Adding Mork Borg later means a new
// `lib/rules/morkborg.ts` conforming to `RulesModule` and one more line
// in this map; nothing that calls `getRulesModule` needs to change.

import type { RulesModule } from './types'
import { SHADOWDARK } from './shadowdark'

export type { RulesModule, RulesClass, RulesAncestry, RulesBackgroundTable, RulesTalentTableRow, Ability } from './types'
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
