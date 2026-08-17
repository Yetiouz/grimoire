// lib/rules/cyborgEquipment.ts
//
// CY_BORG's shop catalog (owner request, 2026-08-17: "there should be a
// toggle to switch on the gear for CY_BORG so all the Shadowdark stuff
// is not in the CY_BORG campaign" — the toggle IS `campaigns.system`,
// this file is the content that key selects). Structured mechanical
// data only (names, dice, prices), transcribed from the owner's
// purchased rulebook — same licensing posture as `equipment.ts`'s
// Shadowdark Core list; descriptive prose stays in the private
// system_packs rows.
//
// Prices are ¤ (CY_BORG credits). Stored in `costCp` at ¤ × 100 so the
// existing Shop math (goldCp comparisons, goldDeltaForSpend) works
// unchanged — this campaign's convention is ¤ ≡ gp 1:1 (see the cyborg
// house_rules pack), so a 60¤ item deducts 60 "gold" exactly. Display
// goes through `formatCredits` below instead of `formatCp` so the
// player sees "60¤", never "60 gp" (Shop's `currency` prop switches).

import type { RulesEquipmentItem } from './equipment'

/** ¤ → costCp under the ¤ ≡ gp convention. */
function cy(n: number) {
  return n * 100
}

export function formatCredits(totalCp: number): string {
  const credits = Math.round(totalCp / 100)
  return `${credits.toLocaleString()}¤`
}

export const CYBORG_EQUIPMENT: RulesEquipmentItem[] = [
  // WEAPONS — the "Weapons for Sale" board. `a` = capable of autofire.
  { key: 'broken-bottle', name: 'Broken bottle/cobblestone', category: 'weapon', costCp: cy(0), detail: 'd3', source: 'CY' },
  { key: 'taser', name: 'Taser', category: 'weapon', costCp: cy(20), detail: 'd2 · test Toughness or fall down', source: 'CY' },
  { key: 'shockstick', name: 'Shockstick', category: 'weapon', costCp: cy(350), detail: 'd4 · test Toughness or fall down', source: 'CY' },
  { key: 'machete', name: 'Machete', category: 'weapon', costCp: cy(20), detail: 'd6', source: 'CY' },
  { key: 'filament-knife', name: 'Filament knife', category: 'weapon', costCp: cy(300), detail: 'd6', source: 'CY' },
  { key: 'monosword', name: 'Monosword', category: 'weapon', costCp: cy(200), detail: 'd8', source: 'CY' },
  { key: 'throwing-knives', name: 'Too many throwing knives', category: 'weapon', costCp: cy(30), detail: 'd4 · two attacks per round', source: 'CY' },
  { key: 'power-tool', name: 'Power tool', category: 'weapon', costCp: cy(35), detail: 'd6 · breaks down on a 1 · ×2 vs vehicles', source: 'CY' },
  { key: 'chainsaw', name: 'Chainsaw', category: 'weapon', costCp: cy(40), detail: 'd6+1 · 1-in-4 to hit yourself on a miss', source: 'CY' },
  { key: 'pneumatic-glove', name: 'Pneumatic glove', category: 'weapon', costCp: cy(300), detail: 'd6 · ignores armor on a crit', source: 'CY' },
  { key: '9mm-pistol', name: '9mm pistol', category: 'weapon', costCp: cy(60), detail: 'd6a', source: 'CY' },
  { key: 'ancient-revolver', name: 'Ancient revolver', category: 'weapon', costCp: cy(50), detail: 'd8', source: 'CY' },
  { key: 'smartgun', name: 'SmartGun™', category: 'weapon', costCp: cy(100), detail: 'd6a · d10a with a SmartJack', source: 'CY' },
  { key: 'small-smgs', name: 'Pair of small SMGs', category: 'weapon', costCp: cy(300), detail: 'd6a · only autofire', source: 'CY' },
  { key: 'assault-rifle', name: 'Assault rifle', category: 'weapon', costCp: cy(400), detail: 'd8a', source: 'CY' },
  { key: 'grenade-launcher', name: 'Grenade launcher', category: 'weapon', costCp: cy(600), detail: 'd6 · up to d3 targets · mounts on AR · ×2 vs vehicles', source: 'CY' },
  { key: 'shotgun', name: 'Shotgun', category: 'weapon', costCp: cy(350), detail: 'd8', source: 'CY' },
  { key: 'sniper-rifle', name: 'Sniper rifle', category: 'weapon', costCp: cy(1000), detail: '2d10 · ×3 damage on crit · aim 2 rounds: −4DR, +3 damage', source: 'CY' },
  { key: 'nailgun', name: 'Nailgun', category: 'weapon', costCp: cy(400), detail: 'd6a · only autofire', source: 'CY' },
  { key: 'laser-turret', name: 'Laser turret', category: 'weapon', costCp: cy(10000), detail: 'd12a · ×2 vs vehicles', source: 'CY' },
  { key: 'rocket-launcher', name: 'Rocket launcher', category: 'weapon', costCp: cy(5000), detail: 'd12 · d4 targets · ignores 2 armor · once per combat · ×2 vs vehicles', source: 'CY' },
  { key: 'flashbang', name: 'Flashbang', category: 'weapon', costCp: cy(25), detail: 'test Toughness or +4DR for d4 rounds', source: 'CY' },
  { key: 'hand-grenade', name: 'Hand grenade', category: 'weapon', costCp: cy(45), detail: 'd6 · up to d3 targets · ×2 vs vehicles', source: 'CY' },
  { key: 'epulse-grenade', name: 'ePulse grenade', category: 'weapon', costCp: cy(60), detail: 'd8 · d3 tech targets or people with 2+ cybertech', source: 'CY' },

  // SINGLE-USE BOOSTER MODS — modify one shot, work with most modern firearms.
  { key: 'booster-inferno', name: 'Inferno rounds', category: 'weapon', costCp: cy(80), detail: 'single use · +d3 damage (+d8 on crit)', source: 'CY' },
  { key: 'booster-ill', name: 'Ill rounds', category: 'weapon', costCp: cy(50), detail: 'single use · Toughness DR14 or no HP recovery until treated', source: 'CY' },
  { key: 'booster-ap', name: 'Armor-piercing rounds', category: 'weapon', costCp: cy(80), detail: 'single use · ignores d6 armor', source: 'CY' },
  { key: 'booster-taginjector', name: 'Taginjector rounds', category: 'weapon', costCp: cy(60), detail: 'single use · no damage · plants tracker or drug/poison dose', source: 'CY' },
  { key: 'booster-knocker', name: 'Knocker rounds', category: 'weapon', costCp: cy(30), detail: 'single use · d2 damage · Toughness DR12 or knocked out d3 rounds', source: 'CY' },
  { key: 'booster-epulse', name: 'E/Pulse rounds', category: 'weapon', costCp: cy(100), detail: 'single use · +d6 damage vs tech or 2+ cybertech', source: 'CY' },
  { key: 'booster-nanotrig', name: 'Nanotrig rounds', category: 'weapon', costCp: cy(100), detail: 'single use · Presence DR14 or trigger a random Nano infestation', source: 'CY' },
  { key: 'booster-frag', name: 'Frag rounds', category: 'weapon', costCp: cy(60), detail: 'single use · d4 damage to up to d3 close targets', source: 'CY' },
  { key: 'booster-ricochet', name: 'Ricochet rounds', category: 'weapon', costCp: cy(50), detail: 'single use · bounces corners and cover · d6 damage, DR16 test', source: 'CY' },
  { key: 'booster-heatseekers', name: 'Heatseeker rounds', category: 'weapon', costCp: cy(120), detail: 'single use · −2DR vs targets giving off body heat', source: 'CY' },

  // ARMOR — tiers, not AC.
  { key: 'styleguard', name: 'StyleGuard', category: 'armor', costCp: cy(100), detail: 'Tier I · −d2 damage · looks just like clothes', source: 'CY' },
  { key: 'rough', name: 'Rough', category: 'armor', costCp: cy(250), detail: 'Tier II · −d4 damage · heavy-duty jacket or full kevlar', source: 'CY' },
  { key: 'smartwear', name: 'SmartWear', category: 'armor', costCp: cy(1500), detail: 'Tier II · −d4 damage · Adrenachrome_HST auto-injector fires when Battered', source: 'CY' },
  { key: 'combat-armor', name: 'Combat Armor', category: 'armor', costCp: cy(10000), detail: 'Tier III · −d6 damage · A_HST auto-injector · +2DR Agility tests incl. Defense', source: 'CY' },

  // EQUIPMENT
  { key: 'backpack', name: 'Backpack', category: 'gear', costCp: cy(5), detail: 'holds 7 normal-sized items', source: 'CY' },
  { key: 'bio-id-scanner', name: 'Bio/ID scanner', category: 'gear', costCp: cy(250), detail: 'tracks a person within 50m · illegal', source: 'CY' },
  { key: 'breathing-mask', name: 'Breathing mask', category: 'gear', costCp: cy(70), detail: 'oxygen in gas or underwater', source: 'CY' },
  { key: 'clothes', name: 'Clothes', category: 'gear', costCp: cy(10), source: 'CY' },
  { key: 'crime-scene-kit', name: 'Crime scene kit', category: 'gear', costCp: cy(250), source: 'CY' },
  { key: 'crowbar', name: 'Crowbar', category: 'gear', costCp: cy(10), detail: 'd4 damage as a weapon', source: 'CY' },
  { key: 'cyberdeck', name: 'Cyberdeck', category: 'gear', costCp: cy(100), detail: 'Knowledge+1 App slots', source: 'CY' },
  { key: 'cyberdeck-plus', name: 'Cyberdeck+', category: 'gear', costCp: cy(1000), detail: 'Knowledge+4 App slots', source: 'CY' },
  { key: 'dna-bomb', name: 'DNA bomb', category: 'gear', costCp: cy(1000), detail: 'fills a 10m area with mixed DNA matter · illegal', source: 'CY' },
  { key: 'drone-suit', name: 'Drone suit', category: 'gear', costCp: cy(400), detail: 'slow, quiet flight · combat tests +4DR airborne', source: 'CY' },
  { key: 'faceblock', name: 'Faceblock', category: 'gear', costCp: cy(35), detail: 'blocks facial recognition · illegal', source: 'CY' },
  { key: 'fake-id', name: 'Fake ID', category: 'gear', costCp: cy(300), detail: 'passes random checks, not active searches · illegal', source: 'CY' },
  { key: 'first-aid-kit', name: 'First-aid kit', category: 'gear', costCp: cy(50), detail: 'd4 uses · stops bleeding/infection, heals d6 HP', source: 'CY' },
  { key: 'flashlight', name: 'Flashlight', category: 'gear', costCp: cy(5), source: 'CY' },
  { key: 'foldable-ladder', name: 'Foldable ladder', category: 'gear', costCp: cy(40), detail: '5m', source: 'CY' },
  { key: 'grapple-crossbow', name: 'Grappling-hook crossbow', category: 'gear', costCp: cy(25), detail: 'd4 damage as a weapon · illegal', source: 'CY' },
  { key: 'lighter', name: 'Lighter', category: 'gear', costCp: cy(1), source: 'CY' },
  { key: 'lockpicks-electronic', name: 'Lockpicks (electronic locks)', category: 'gear', costCp: cy(300), detail: 'illegal', source: 'CY' },
  { key: 'lockpicks-mechanical', name: 'Lockpicks (mechanical locks)', category: 'gear', costCp: cy(25), source: 'CY' },
  { key: 'magnesium-strip', name: 'Magnesium strip', category: 'gear', costCp: cy(4), source: 'CY' },
  { key: 'micro-torch-cutter', name: 'Micro torch cutter', category: 'gear', costCp: cy(150), detail: 'd3 uses', source: 'CY' },
  { key: 'multitool', name: 'Multitool', category: 'gear', costCp: cy(15), source: 'CY' },
  { key: 'noisemaker', name: 'Noisemaker', category: 'gear', costCp: cy(65), detail: 'blocks remote comms/surveillance 20m for d4 minutes · d3 uses · illegal', source: 'CY' },
  { key: 'optic-camo-suit', name: 'Optic camo suit', category: 'gear', costCp: cy(400), detail: 'stationary: invisible · moving: hard to see · d6 uses · illegal', source: 'CY' },
  { key: 'paracord', name: 'Paracord', category: 'gear', costCp: cy(10), detail: '30m', source: 'CY' },
  { key: 'pulverized-acid', name: 'Pulverized acid', category: 'gear', costCp: cy(30), source: 'CY' },
  { key: 'keycard-skimmer', name: 'RFID/keycard skimmer', category: 'gear', costCp: cy(200), detail: '20% cumulative chance (max 60%) of copying a held keycard · illegal', source: 'CY' },
  { key: 'scum-explosive', name: 'Scum explosive', category: 'gear', costCp: cy(100), detail: 'enough for a moderately reinforced door · illegal', source: 'CY' },
  { key: 'silencer', name: 'Silencer', category: 'gear', costCp: cy(250), detail: 'illegal', source: 'CY' },
  { key: 'spray-can', name: 'Spray can/marker', category: 'gear', costCp: cy(5), source: 'CY' },
  { key: 'superglue', name: 'Superglue', category: 'gear', costCp: cy(10), source: 'CY' },
  { key: 'superlube', name: 'Superlube', category: 'gear', costCp: cy(15), source: 'CY' },
  { key: 'surveillance-drone', name: 'Surveillance drone', category: 'gear', costCp: cy(250), detail: '300m range, fly-sized · illegal', source: 'CY' },
  { key: 'visionvisor', name: 'Visionvisor', category: 'gear', costCp: cy(100), detail: 'zoom, heat/night vision, ultrasound', source: 'CY' },
  { key: 'zip-ties', name: 'Zip ties', category: 'gear', costCp: cy(2), source: 'CY' },

  // DRUGS — full-strength dose price (weaker recreational doses cost less).
  { key: 'red-juice', name: 'Red-juice', category: 'gear', costCp: cy(40), detail: 'heals d10 HP once per day', source: 'CY' },
  { key: 'adrenachrome', name: 'Adrenachrome_HST', category: 'gear', costCp: cy(60), detail: 'heal d6 HP · +1 all abilities d6 rounds, then −1 until rest', source: 'CY' },
  { key: 'sunset-chalk', name: 'Sunset Chalk', category: 'gear', costCp: cy(30), detail: 'Toughness DR14 or unable to use violence except self-defense, d10 min', source: 'CY' },
  { key: 'rattle', name: 'Rattle', category: 'gear', costCp: cy(30), detail: 'Toughness DR12 or unable to stop talking d6×10 min', source: 'CY' },
  { key: 'c-vortex', name: 'C/Vortex', category: 'gear', costCp: cy(70), detail: 'creativity tests (Nano etc.) −2DR for d10 min', source: 'CY' },
  { key: 'blackout', name: 'Blackout', category: 'gear', costCp: cy(40), detail: 'Toughness DR14 or d6 damage + blinded one hour', source: 'CY' },
  { key: 'miura', name: 'Miura', category: 'gear', costCp: cy(80), detail: 'Toughness DR12 or frenzy d6 rounds at random targets', source: 'CY' },
  { key: 'bullseye', name: 'Bullseye', category: 'gear', costCp: cy(70), detail: 'concentration tests (snipe, Apps) −2DR for d10 min', source: 'CY' },
  { key: 'red-pain', name: 'Red Pain', category: 'gear', costCp: cy(40), detail: 'Toughness DR12 or d10 damage', source: 'CY' },
  { key: 'osleep', name: 'Osleep', category: 'gear', costCp: cy(30), detail: 'removes need to sleep · after 2 days Toughness DR8 or collapse', source: 'CY' },
  { key: 'pink-ooze', name: 'Pink Ooze', category: 'gear', costCp: cy(25), detail: 'Toughness DR14 or all hits +d4 damage for 5 min', source: 'CY' },
  { key: 'vurt', name: 'Vurt', category: 'gear', costCp: cy(350), detail: 'd6 hours of shared hallucinations', source: 'CY' },

  // CYBERTECH — implant prices as listed; installation is the street doc's problem.
  { key: 'cyberclaws', name: 'Retracting cyberclaws', category: 'weapon', costCp: cy(2000), detail: 'implant · d6 damage', source: 'CY' },
  { key: 'mule-pocket', name: 'Mule pocket', category: 'gear', costCp: cy(500), detail: 'implant · hidden cavity, fits a SmartGun™', source: 'CY' },
  { key: 'subdermal-shockers', name: 'Subdermal shockers', category: 'gear', costCp: cy(2000), detail: 'implant · d4 to melee attackers · +2DR to avoid electrical damage', source: 'CY' },
  { key: 'autocamo', name: 'Autocamo', category: 'gear', costCp: cy(3000), detail: 'implant · anti-facial-recognition skin projection', source: 'CY' },
  { key: 'additional-joints', name: 'Additional joints', category: 'gear', costCp: cy(2000), detail: 'implant · −2DR grapple tests · fits small spaces', source: 'CY' },
  { key: 'buzzeyes', name: 'Buzzeyes', category: 'gear', costCp: cy(3000), detail: 'implant · 360° vision', source: 'CY' },
  { key: 'strangler', name: 'Strangler', category: 'weapon', costCp: cy(300), detail: 'implant · finger filament wire · d6/round while grappling', source: 'CY' },
  { key: 'skinhard', name: 'Skinhard', category: 'armor', costCp: cy(3000), detail: 'implant · hardened skin, −d2 armor', source: 'CY' },
  { key: 'deserter-fangs', name: 'Deserter fangs', category: 'weapon', costCp: cy(500), detail: 'implant · DR10 bite, d6 · 2-in-6 free attack against you', source: 'CY' },
  { key: 'smartjack', name: 'SmartJack', category: 'gear', costCp: cy(4000), detail: 'implant · unlocks full Smart™-tech potential', source: 'CY' },
  { key: 'muscle-ups', name: 'Muscle-ups', category: 'gear', costCp: cy(5000), detail: 'implant · +1 raw-strength tests · +4 carry capacity', source: 'CY' },
  { key: 'pulsewires', name: 'PulseWires', category: 'gear', costCp: cy(6000), detail: 'implant · +1 AGI/PRE/STR/TOUGH for 2h · 75¤ per pulse', source: 'CY' },
  { key: 'bodygun', name: 'BodyGun', category: 'weapon', costCp: cy(7500), detail: 'implant · hidden single-shot, 2d10', source: 'CY' },
  { key: 'taurs', name: 'Taurs', category: 'weapon', costCp: cy(1500), detail: 'implant · horns, d4', source: 'CY' },
  { key: 'sonic-blaster', name: 'Sonic blaster', category: 'weapon', costCp: cy(6000), detail: 'implant · d6 to d3 targets · recharges every 6h', source: 'CY' },
  { key: 'handy-bot', name: 'Handy bot', category: 'gear', costCp: cy(4000), detail: 'implant · detachable drone hand, 50m range', source: 'CY' },
  { key: 'smarthair', name: 'Smarthair', category: 'gear', costCp: cy(1200), detail: 'implant · change hairstyle at will', source: 'CY' },
  { key: 'skinslot', name: 'Skinslot', category: 'gear', costCp: cy(1500), detail: 'implant · hidden extra App slot', source: 'CY' },
  { key: 'skeleplating', name: 'Skeleplating', category: 'gear', costCp: cy(15000), detail: 'implant · metal-layered skeleton, +10 HP', source: 'CY' },
  { key: 'brainbox', name: 'Brainbox', category: 'gear', costCp: cy(500000), detail: 'implant · black box for your brain · mind restartable at death', source: 'CY' },
]
