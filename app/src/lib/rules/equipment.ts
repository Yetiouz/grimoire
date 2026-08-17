// lib/rules/equipment.ts
//
// Owner request, 2026-08-15 ("when you get to the gear screen there
// needs to be a shop list where you can be like 1 of these 1 of these
// 1 of these and submit/or refund") — a priced catalog for the new Shop
// component, which the Gear step of `CharacterBuilder.tsx` uses to let a
// player spend rolled/typed gold on real items instead of typing
// freeform gear names into a blank text box. Same never-fabricate
// discipline as `RulesClass.spellList`/`primaryAbilities` elsewhere in
// this seam — every name, price, and stat below is transcribed verbatim
// from the Shadowdark core rulebook (`Shadowdark_RPG_-_V4-9_compressed.pdf`
// pg. 34-37, confirmed against two separate passes of the project's own
// PDF via `project_search`), not approximated or invented.
//
// Core only for v1 — the owner's scoping answer confirmed the shop must
// exist in character creation and said a during-play general store
// "pulls up the same or similar list of things the game has prices for,"
// but didn't weigh in on Core-only vs. Core+expansions when asked
// directly. Defaulting to Core-only here: it's the rulebook every
// character creation flow already draws its classes/ancestries/gear-roll
// table from (`shadowdark.ts`'s own `zeroLevelGear` table is Core-only
// too), and the three Cursed Scroll expansions each add their own
// small, clearly-scoped weapon/armor lists (Diablerie: Handaxe, Stave,
// Round shield; Red Sands: Blowgun, Bolas, Morningstar, Pike, Razor
// chain, Scimitar, Shuriken, Sling, Whip) that can be appended as a
// second array later without touching this one, same "adding a system
// is a new file, not a rewrite" seam `index.ts` already documents for
// whole rules modules.
//
// Left out of the catalog on purpose, not missed:
// - Coin and Gem (Basic Gear table, pg. 35) — priced "Varies", i.e. loot
//   categories, not fixed-price shop stock.
// - Mithral (Armor table, pg. 36) — a x4-cost/-1-slot MODIFIER applied to
//   another armor item, not a standalone purchasable item; the Shop's
//   one-name-per-line model (matching how `equipment: string[]` already
//   stores gear) has nowhere to hang "this leather armor, but mithral"
//   without a real item-modifier feature this app doesn't have yet.
// - The Crawling Kit (pg. 36) — a pre-bundled kit of seven of the items
//   already listed individually below, at the same total price (7 gp)
//   the sum of its parts costs anyway. Adding it as its own catalog
//   entry would need the same missing item-modifier/bundle plumbing as
//   Mithral to expand into seven real gear-slot entries on purchase.

export type EquipmentCategory = 'gear' | 'armor' | 'weapon'

export interface RulesEquipmentItem {
  /** Stable slug for React keys/cart bookkeeping — not shown anywhere. */
  key: string
  /** Exact rulebook name. This is what gets pushed into `equipment:
   * string[]` on purchase, so it reads identically next to every other
   * entry that array already holds (manually-typed items, zero-level
   * gear-roll results). */
  name: string
  category: EquipmentCategory
  /** Normalized to copper pieces (1 gp = 10 sp = 100 cp, pg. 34) so the
   * Shop can compare a single number against a character's gold instead
   * of juggling three denominations per comparison. */
  costCp: number
  /** Short caption shown under the name — AC for armor, damage/range/
   * properties for weapons. Omitted for Basic Gear, which the rulebook
   * gives no combat stats for. */
  detail?: string
  /** Which catalog this row belongs to — 'Core' (Shadowdark) or 'CY'
   * (CY_BORG, see ./cyborgEquipment.ts). Widened from the original
   * 'Core' literal when the second system's shop landed (2026-08-17). */
  source: 'Core' | 'CY'
}

function gp(n: number) {
  return n * 100
}
function sp(n: number) {
  return n * 10
}

export const CORE_EQUIPMENT: RulesEquipmentItem[] = [
  // Basic Gear — pg. 35
  { key: 'arrows-20', name: 'Arrows (20)', category: 'gear', costCp: gp(1), source: 'Core' },
  { key: 'backpack', name: 'Backpack', category: 'gear', costCp: gp(2), source: 'Core' },
  { key: 'caltrops', name: 'Caltrops (one bag)', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'crossbow-bolts-20', name: 'Crossbow bolts (20)', category: 'gear', costCp: gp(1), source: 'Core' },
  { key: 'crowbar', name: 'Crowbar', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'flask-or-bottle', name: 'Flask or bottle', category: 'gear', costCp: sp(3), source: 'Core' },
  { key: 'flint-and-steel', name: 'Flint and steel', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'grappling-hook', name: 'Grappling hook', category: 'gear', costCp: gp(1), source: 'Core' },
  { key: 'iron-spikes-10', name: 'Iron spikes (10)', category: 'gear', costCp: gp(1), source: 'Core' },
  { key: 'lantern', name: 'Lantern', category: 'gear', costCp: gp(5), source: 'Core' },
  { key: 'mirror', name: 'Mirror', category: 'gear', costCp: gp(10), source: 'Core' },
  { key: 'oil-flask', name: 'Oil, flask', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'pole', name: 'Pole', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'rations-3', name: 'Rations (3)', category: 'gear', costCp: sp(5), source: 'Core' },
  { key: 'rope-60', name: "Rope, 60'", category: 'gear', costCp: gp(1), source: 'Core' },
  { key: 'torch', name: 'Torch', category: 'gear', costCp: sp(5), source: 'Core' },

  // Armor — pg. 36
  { key: 'leather-armor', name: 'Leather armor', category: 'armor', costCp: gp(10), detail: '11 + DEX mod', source: 'Core' },
  { key: 'chainmail', name: 'Chainmail', category: 'armor', costCp: gp(60), detail: '13 + DEX mod · disadv. on stealth, swim', source: 'Core' },
  { key: 'plate-mail', name: 'Plate mail', category: 'armor', costCp: gp(130), detail: '15 AC · no swim, disadv. on stealth', source: 'Core' },
  { key: 'shield', name: 'Shield', category: 'armor', costCp: gp(10), detail: '+2 AC · occupies one hand', source: 'Core' },

  // Weapons — pg. 37
  { key: 'bastard-sword', name: 'Bastard sword', category: 'weapon', costCp: gp(10), detail: '1d8/1d10 · Melee, Close · Versatile, 2 slots', source: 'Core' },
  { key: 'club', name: 'Club', category: 'weapon', costCp: 5, detail: '1d4 · Melee, Close', source: 'Core' },
  { key: 'crossbow', name: 'Crossbow', category: 'weapon', costCp: gp(8), detail: '1d6 · Ranged, Far · Two-handed, Loading', source: 'Core' },
  { key: 'dagger', name: 'Dagger', category: 'weapon', costCp: gp(1), detail: '1d4 · Melee/Ranged, Close/Near · Finesse, Thrown', source: 'Core' },
  { key: 'greataxe', name: 'Greataxe', category: 'weapon', costCp: gp(10), detail: '1d8/1d10 · Melee, Close · Versatile, 2 slots', source: 'Core' },
  { key: 'greatsword', name: 'Greatsword', category: 'weapon', costCp: gp(12), detail: '1d12 · Melee, Close · Two-handed, 2 slots', source: 'Core' },
  { key: 'javelin', name: 'Javelin', category: 'weapon', costCp: sp(5), detail: '1d4 · Melee/Ranged, Close/Far · Thrown', source: 'Core' },
  { key: 'longbow', name: 'Longbow', category: 'weapon', costCp: gp(8), detail: '1d8 · Ranged, Far · Two-handed', source: 'Core' },
  { key: 'longsword', name: 'Longsword', category: 'weapon', costCp: gp(9), detail: '1d8 · Melee, Close', source: 'Core' },
  { key: 'mace', name: 'Mace', category: 'weapon', costCp: gp(5), detail: '1d6 · Melee, Close', source: 'Core' },
  { key: 'shortbow', name: 'Shortbow', category: 'weapon', costCp: gp(6), detail: '1d4 · Ranged, Far · Two-handed', source: 'Core' },
  { key: 'shortsword', name: 'Shortsword', category: 'weapon', costCp: gp(7), detail: '1d6 · Melee, Close', source: 'Core' },
  { key: 'spear', name: 'Spear', category: 'weapon', costCp: sp(5), detail: '1d6 · Melee/Ranged, Close/Near · Thrown', source: 'Core' },
  { key: 'staff', name: 'Staff', category: 'weapon', costCp: sp(5), detail: '1d4 · Melee, Close · Two-handed', source: 'Core' },
  { key: 'warhammer', name: 'Warhammer', category: 'weapon', costCp: gp(10), detail: '1d10 · Melee, Close · Two-handed', source: 'Core' },
]

/** "12 gp, 3 sp" style formatting for a copper total — Shop's own running-
 * total display. Drops a denomination that's zero rather than always
 * showing all three (`5 cp` alone for Club, not `0 gp, 0 sp, 5 cp`). */
export function formatCp(totalCp: number): string {
  const parts = cpToGoldParts(totalCp)
  const out: string[] = []
  if (parts.gp > 0) out.push(`${parts.gp} gp`)
  if (parts.sp > 0) out.push(`${parts.sp} sp`)
  if (parts.cp > 0 || out.length === 0) out.push(`${parts.cp} cp`)
  return out.join(', ')
}

/** Splits a total copper amount into the fewest coins — maximize gp,
 * then sp, then the cp remainder. This is the CANONICAL breakdown Shop
 * writes back after every buy/return (see `goldDeltaForSpend` below),
 * not just a display helper: `adjust_character_gold` (migration 0009)
 * clamps each of gp/sp/cp independently at 0 with no cross-denomination
 * borrowing, so a delta built from a mismatched breakdown (e.g.
 * subtracting 5 sp from a character actually holding 0 sp but 10 gp)
 * would silently undercharge instead of drawing from the gp on hand.
 * Recomputing the full canonical breakdown on every transaction and
 * diffing against the character's actual current breakdown (see
 * `goldDeltaForSpend`) sidesteps that: the delta this produces always
 * lands exactly on a non-negative result, so the RPC's per-denomination
 * clamp never fires unexpectedly. */
export function cpToGoldParts(totalCp: number): { gp: number; sp: number; cp: number } {
  const safe = Math.max(0, Math.floor(totalCp))
  const g = Math.floor(safe / 100)
  const s = Math.floor((safe % 100) / 10)
  const c = safe % 10
  return { gp: g, sp: s, cp: c }
}

/** Exact (case-insensitive) name lookup against the Core catalog —
 * added overnight 2026-08-17 alongside the item-icon set (see
 * `ItemBustIcon` in `AncestryClassArt.tsx`) so `GearSlotGrid` can show
 * an icon next to an owned gear line without owning any catalog
 * knowledge itself. Deliberately EXACT match only, not a substring/
 * keyword search: `equipment: string[]` also holds freeform typed
 * items and 0-level gear-roll bundles like "Crawling kit: backpack,
 * flint and steel, 2 torches, ..." that happen to contain a catalog
 * word without BEING that item — a substring match would slap a
 * dagger icon on a sentence that mentions daggers in passing. Same
 * never-guess discipline `Shop`'s own `ownedCounts` comment already
 * documents for the identical problem (a non-catalog line just gets
 * no icon, same as it gets no owned-count/refund button there). */
export function findEquipmentByName(name: string): RulesEquipmentItem | undefined {
  const normalized = name.trim().toLowerCase()
  return CORE_EQUIPMENT.find((item) => item.name.toLowerCase() === normalized)
}

/** Accepts the two gold shapes already in play across this app —
 * `CharacterGold` (numbers, possibly undefined, from `characters.gold`)
 * during play, and the Gear step's own string-valued `{gp,sp,cp}` text
 * fields during creation — normalized to a single copper total so Shop
 * can compare cost against balance with one number either way. */
export function goldToCp(gold: { gp?: number | string; sp?: number | string; cp?: number | string }): number {
  return (Number(gold.gp) || 0) * 100 + (Number(gold.sp) || 0) * 10 + (Number(gold.cp) || 0)
}

/** The gp/sp/cp delta to hand `adjustCharacterGold` (during play) for a
 * `deltaCp`-copper spend (negative) or refund (positive) against a
 * character's CURRENT actual breakdown — see `cpToGoldParts`'s doc
 * comment for why this re-normalizes the whole balance each time rather
 * than diffing just the item's own price in isolation. Also reused
 * during creation (`CharacterBuilder`'s local gold state), where the
 * caller applies the resulting canonical parts directly with `setGold`
 * instead of an RPC delta — same math, no server round-trip. */
export function goldDeltaForSpend(
  current: { gp?: number | string; sp?: number | string; cp?: number | string },
  deltaCp: number,
): { gp: number; sp: number; cp: number } {
  const oldCp = goldToCp(current)
  const newParts = cpToGoldParts(oldCp + deltaCp)
  return {
    gp: newParts.gp - (Number(current.gp) || 0),
    sp: newParts.sp - (Number(current.sp) || 0),
    cp: newParts.cp - (Number(current.cp) || 0),
  }
}
