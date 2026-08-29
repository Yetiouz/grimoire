// lib/rules/cyborgTraits.ts
//
// CY_BORG's flavor-roll tables (p.54-57, reprinted for NPC generation
// p.120-121) plus the starting weapon/armor rolls (p.58-60/62-64) that
// `cyborg.ts`'s per-class `gearRollNote` used to just point at in prose
// ("roll d6 for weapon and d2 for armor on the class's own table — not
// transcribed here"). All five tables and both roll tables are now real
// data, transcribed from `claude/cyborg-rulebook-extracted-text.md` in
// the Shadowdark project (pdftotext -layout, cross-checked against the
// book's own appendix reprint of Style/Feature/Wants/Quirk/Obsession on
// p.120-121 where the two extractions could be compared).
//
// One noted discrepancy, flagged rather than silently resolved: the
// Wants table's entry 18 reads "Self-actualization" in the p.54-57
// character-creation extraction but "Self-transformation" in the
// p.120-121 appendix reprint of the same table. Both are transcribed
// faithfully from their own source location; this file uses the
// character-creation-context version ("Self-actualization") since that's
// the printed home of this table for PC creation, and notes the variant
// inline.
//
// The weapon table's own header reads "D12 OR BY CLASS" (p.58) and the
// armor table's reads "D3 OR BY CLASS" (p.60/64) — read literally, a
// class that says "roll d6 for weapon" is rolling a d6 on the FIRST 6
// entries of this same universal table, not a separate unpublished list.
// That's the interpretation used here (`CyborgClass.weaponRollDie`/
// `armorRollFormula` in `./cyborg.ts` index into/roll against these same
// tables) — grounded in the book's own header, not invented. Two classes
// (Discharged CorpKiller, Renegade Cyberslasher) print their own distinct
// d6 tables instead of using the universal one; those are `CYBORG_CORPKILLER_WEAPONS`
// and `CYBORG_CYBERSLASHER_WEAPONS` below.

/** p.58/62-63, "You also begin with one of these" — the universal
 * starting-weapon table. Classes with a plain "roll dN for weapon" note
 * (N=6, 8, or 12) roll 1dN against the first N entries of this list. */
export const CYBORG_STARTING_WEAPONS: { roll: number; name: string; damage: string; note?: string }[] = [
  { roll: 1, name: 'Broken bottle', damage: 'd3' },
  { roll: 2, name: 'Machete', damage: 'd6', note: 'Optionally: shiv, brick, sharpened femur bone.' },
  { roll: 3, name: 'Throwing knives', damage: 'd4', note: 'Too many — two attacks/round.' },
  { roll: 4, name: 'Ancient revolver', damage: 'd8' },
  { roll: 5, name: 'SmartGun™', damage: 'd6a', note: 'd10a with a SmartJack.' },
  { roll: 6, name: 'Two small SMGs', damage: 'd6a', note: 'Only autofire.' },
  { roll: 7, name: 'Shotgun', damage: 'd8' },
  { roll: 8, name: 'Monosword', damage: 'd8' },
  { roll: 9, name: 'Assault rifle', damage: 'd8a', note: 'Can be fitted with a grenade launcher (d6, up to d3 targets).' },
  { roll: 10, name: 'Pulse Rifle', damage: 'd10a' },
  { roll: 11, name: 'Sniper rifle', damage: '2d10', note: '×3 crit damage. Aiming 2 rounds: −4DR, +3 damage.' },
  { roll: 12, name: 'Sniper rifle', damage: '2d10', note: 'Duplicate top slot in the printed table — reroll if you want a distinct result.' },
]

/** p.50, Discharged CorpKiller's own d6 "you took something from your
 * employer" heavy-weapon table — replaces the universal table entirely
 * for this class, not a subset of it. */
export const CYBORG_CORPKILLER_WEAPONS: { roll: number; name: string; damage: string; note?: string }[] = [
  { roll: 1, name: 'Old-school heavy machine gun', damage: 'd12a', note: 'Breaks down after a damage roll of 1; fix with 10 minutes of quiet time.' },
  { roll: 2, name: 'Prototype Smart™ assault rifle', damage: 'd10a', note: 'Around-the-corner shooting, camera sight, grenade launcher — the works.' },
  { roll: 3, name: 'Hand grenades and flashbangs', damage: '—', note: 'Toughness+5 hand grenades and 5 flashbangs. You throw grenades with −2DR.' },
  { roll: 4, name: 'Heavy laser cannon', damage: 'd12', note: 'Presence DR14 vs people/bots/animals. 3d12, Presence DR10 vs vehicles/turrets/similar.' },
  { roll: 5, name: 'Crowd-control air cannon', damage: 'd6', note: 'Can hit up to d3 targets close to each other.' },
  { roll: 6, name: 'Incendiary shotgun', damage: 'd10', note: 'Agility DR12 or flammable materials ignite for +d6 damage next round.' },
]

/** p.54, Renegade Cyberslasher's own d6 melee-weapon table — replaces
 * the universal table entirely for this class. */
export const CYBORG_CYBERSLASHER_WEAPONS: { roll: number; name: string; damage: string; note?: string }[] = [
  { roll: 1, name: 'Ancient blade', damage: 'd8', note: 'Has claimed 1,000 souls (or so you say). If you strike first in combat, deal double damage.' },
  { roll: 2, name: 'Steelcutter chainsaw', damage: 'd8', note: 'Not made for combat. On max damage it gets stuck d3 rounds, dealing damage automatically while stuck.' },
  { roll: 3, name: 'Filament zweihänder', damage: 'd10', note: 'Makes everyone nearby nervous. Crits throw the target airborne — an easy target (−2DR) for anyone else.' },
  { roll: 4, name: 'Wire-wrapped baseball bat', damage: 'd8', note: 'Hooked to a battery. Supercharge it: +d4 damage to target AND to yourself.' },
  { roll: 5, name: 'Dual Logans', damage: 'd8', note: 'Once per fight, surprise a victim with foot claws too, attacking at DR8.' },
  { roll: 6, name: 'GodDAMN flail', damage: 'd8', note: 'Spiked. Absolutely medieval. Shreds enemy armor a tier when you hit for 6+ damage.' },
]

/** p.60/64, armor tiers. A class's own "roll dN for armor" (e.g. "d2",
 * "d4+1") picks a tier number directly from this table (0 = none), not
 * an index — CorpKiller's d4+1 can reach tier 5, which doesn't exist, so
 * cap any roll at tier 4 in the UI. */
export const CYBORG_ARMOR_TIERS: { tier: number; name: string; reduction: string; note: string }[] = [
  { tier: 0, name: 'No armor', reduction: '—', note: '' },
  { tier: 1, name: 'StyleGuard', reduction: '−d2', note: 'Looks just like clothes!' },
  { tier: 2, name: 'Rough', reduction: '−d4', note: 'A heavy-duty jacket or full kevlar.' },
  { tier: 3, name: 'SmartWear', reduction: '−d6', note: '+2DR on Agility tests including Defense. Equipped with an Adrenachrome_HST auto-injector that fires if the wearer is Battered.' },
  { tier: 4, name: 'Combat Armor / EndGame-Class ExoSuit', reduction: '−d8', note: '+4DR on Agility tests (+2DR of that on Defense); Strength and Toughness are −2DR. Can jump 4× regular height and length. Multiple customizable injectors, jump jets, motorized joints. Not for sale.' },
]

/** p.54-57 (character-creation context) / p.120-121 (appendix reprint,
 * NPC-generation context — identical content, cross-checked against
 * this list). d100, read as 50 paired entries (01-02, 03-04, ...). */
export const CYBORG_STYLE: string[] = [
  '0core', 'Acid panda', 'Beastie', 'Bitcrusher', 'Bloodsport', 'Cadavercore', 'Codefolk', 'Converter',
  'Corpodrone', 'Cosmopunk', 'Cvlt', 'Cybercrust', 'CyPop', 'Daemonista', 'Deathbloc', 'Doomtroop',
  'Ghoul', 'Glitchmode', 'Goregrinder', 'Gutterscum', 'Hexcore', 'Hype street', 'Kill mode', 'Meta',
  'Mimic', 'Minimal', 'Minotaur', 'Mobwave', 'Monsterwave', 'Murdercore', 'Necropop', 'Neurotripper',
  'NuFlesh', 'NuGoth', 'NuPrep', 'Oceanwave', 'OG', 'Old-school cyberpunk', 'Orbital', 'Postlife',
  'Pyrocore', 'Razormouth', 'Retro metal', 'Riot kid', 'Robomode', 'Roller bruiser', 'Technoir',
  'Trad punk', 'Wallgoth', 'Waster',
]

/** p.55/59 (character-creation) / p.120 (appendix reprint). d100, 50
 * paired entries. */
export const CYBORG_FEATURE: string[] = [
  'Abundance of rings', 'All monochrome', 'Artificial skin', 'Beastlike', 'Broken nose', 'Burn scars',
  'Completely hairless', 'Cosmetic gills', 'Covered in tattoos', 'Customized voicebox', 'Disheveled look',
  'Dollfaced', 'Dueling scars', 'Elaborate hairstyle', 'Enhanced cheekbones', 'Fluorescent veins',
  'Forehead display', 'Giant RCD helmet rig', 'Glitterskin', 'Glowing respirator', 'Golden grillz',
  'Headband', 'Heavy on the makeup', 'Holomorphed face', 'Interesting perfume', 'Lace trimmings',
  'Laser branded', 'Lipless — just teeth', 'Mirror eyes', 'More plastic than skin', 'Necrotic face',
  'Nonhuman ears', 'Palms covered in notes', 'Pattern overdose', 'Plenty of piercings', 'Radiant eyebrows',
  'Rainbow haircut', 'Ritual scarifications', 'Robotlike', 'Shoulder pads', 'Subdermal implants',
  'Tons of jewelry', 'Traditional amulets', 'Translucent skin', 'Transparent wear', 'Unkempt hair',
  'Unnatural eyes', 'UV-inked face', 'VIP lookalike', 'War paints',
]

/** p.57 (character-creation) / p.121 (appendix reprint). d100, 50
 * paired entries. */
export const CYBORG_OBSESSION: string[] = [
  'Adrenaline', 'AI poetry', 'Ammonium chloride candy', 'Ancient grimoires', 'Arachnids', 'Belts',
  'Blades', 'Bones', 'Customized cars', 'Dronespotting', 'Experimental stimuli', 'Explosives',
  'Extravagant manicure', 'Gauze and band-aids', 'Gin', 'Graffiti', 'Hand-pressed synthpresso',
  'Handheld games', 'Headphones', 'History sims', 'Interactive holo-ink', 'Journaling', 'Masks',
  'Medieval weaponry', 'Microbots', 'Mixing stimulants', 'Model mech kits', 'Obsolete tech',
  'Porcelain figurines', 'Printed shirts', 'Puppets', 'Records', 'Recursive synthesizers', 'Shades',
  'Slacklining', 'Sneakers', 'Stim smokes', 'Style hopping', 'Tarot', 'Taxidermy', 'Trendy food',
  'Urban exploring', 'Vampires vs. werewolves', 'Vintage army jackets', 'Vintage TV shows',
  'Virtuaflicks', 'Virtuapals', 'Voice modulators', 'Watches', 'Wigs',
]

/** p.57 (character-creation) / p.121 (appendix reprint). d20. */
export const CYBORG_QUIRK: string[] = [
  'Chainsmoker', 'Chews on hair', 'Compulsive swearing', 'Constantly watching holos', 'Coughs',
  'Fiddles with jewelry', 'Flirty', 'Gestures a lot', 'Giggles inappropriately',
  'Hat/hood and shades, always', 'Itchy', 'Loudly chews gum', 'Must tag every location',
  'Never looks anyone in the eye', 'Nosepicker', 'Rapid blinking', 'Reeks of lighter fluid',
  'Scratches facial scar', 'Twitchy', 'Wheezes',
]

/** p.57 (character-creation) / p.121 (appendix reprint, entry 18 reads
 * "Self-transformation" there instead of "Self-actualization" — see the
 * file header note). d20. */
export const CYBORG_WANTS: string[] = [
  'Anarchy', 'Burn it all down', 'Cash', 'Drugs', 'Enlightenment', 'Fame', 'Freedom', 'Fun', 'Justice',
  'Love', 'Mayhem', 'Power over others', 'Revenge', 'Safety for loved ones', 'Save the world',
  'See others fail', 'Self-control', 'Self-actualization', 'Success', 'To kill',
]

/** Rolls d100 and returns the paired-entry index (0-49) for the 50-item
 * tables above (Style/Feature/Obsession). Pass a 1-100 roll. */
export function pairedIndexForD100(roll: number): number {
  const clamped = Math.min(100, Math.max(1, roll))
  return Math.ceil(clamped / 2) - 1
}
