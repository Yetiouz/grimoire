// lib/rules/cyborg.ts
//
// CY_BORG's own creation data — deliberately NOT a `RulesModule` (see
// `./types.ts`). That interface is Shadowdark-shaped down to its bones:
// six named abilities with a raw-score+modifier split, ancestries,
// alignment, deities, a d20 background table, an AC formula. CY_BORG has
// five abilities that ARE their own -3..+3 modifier (no separate score),
// no ancestry/alignment/deity concept at all, and Debt/Glitches with no
// Shadowdark equivalent to hang off `RulesModule`'s existing fields.
// Forcing it into that shape would mean either lying about what half the
// fields mean or growing `RulesModule` into a lowest-common-denominator
// blob that fits neither system well — the owner's own call (2026-08-26,
// AskUserQuestion: "Give CY_BORG its own separate types + wizard
// branch") after `CyborgCharacterBuilder.tsx` hit this exact wall.
//
// Every value below is transcribed from the owner's purchased CY_BORG
// PDF (`pdftotext -layout` for most of it; a few stylized full-page
// class-name spreads were only readable by rendering those pages to PNG
// and reading them directly — see claude/cyborg-class-roster-grounded.md
// in the Shadowdark project for the extraction method and page
// citations). Printed page numbers are cited in each block's own comment
// so a future correction has somewhere to check against. Nothing here is
// invented to fill a gap — where the book references a roll table this
// pass couldn't reliably extract (a few classes' own "roll dN for
// starting weapon" tables), that's called out in the class's own
// `gearRollNote` rather than papered over with a guess.

export type CyborgAbility = 'agility' | 'knowledge' | 'presence' | 'strength' | 'toughness'

/** Order matches the book's own list (p.41/165) and `CYBORG_DISPLAY.abilities`
 * in `./index.ts` — keep these in sync if either changes. */
export const CYBORG_ABILITY_ORDER: CyborgAbility[] = ['agility', 'knowledge', 'presence', 'strength', 'toughness']

export const CYBORG_ABILITY_INFO: Record<CyborgAbility, { label: string; short: string; tests: string }> = {
  agility: { label: 'Agility', short: 'AGI', tests: 'Sneak, dodge, drive, autofire' },
  knowledge: { label: 'Knowledge', short: 'KNO', tests: 'Science, use tech or App' },
  presence: { label: 'Presence', short: 'PRE', tests: 'Snipe/shoot, use Nano, persuade' },
  strength: { label: 'Strength', short: 'STR', tests: 'Strike, grapple, lift, throw' },
  toughness: { label: 'Toughness', short: 'TOU', tests: 'Survive falling, poison, and elements' },
}

/** DR table, p.41/165. Test = d20 ± ability score vs DR. */
export const CYBORG_DR_TABLE: { dr: number; label: string }[] = [
  { dr: 6, label: 'simple' },
  { dr: 8, label: 'routine' },
  { dr: 10, label: 'easy' },
  { dr: 12, label: 'NORMAL' },
  { dr: 14, label: 'difficult' },
  { dr: 16, label: 'really hard' },
  { dr: 18, label: 'almost impossible' },
]

/** 3d6-sum → ability score, p.40. Every class ability reroll below is
 * still a 3d6 roll (with a flat +/- applied to the SUM before reading
 * this table) — "roll 3d6+2 for Presence" means sum three d6, add 2,
 * then look up the result here, not "add 2 to the final score." */
export const CYBORG_SCORE_TABLE: { min: number; max: number; score: number }[] = [
  { min: -Infinity, max: 4, score: -3 },
  { min: 5, max: 6, score: -2 },
  { min: 7, max: 8, score: -1 },
  { min: 9, max: 12, score: 0 },
  { min: 13, max: 14, score: 1 },
  { min: 15, max: 16, score: 2 },
  { min: 17, max: Infinity, score: 3 },
]

export function scoreForRoll(total: number): number {
  const row = CYBORG_SCORE_TABLE.find((r) => total >= r.min && total <= r.max)
  return row ? row.score : 0
}

/** p.61. "How badly do they want their cash back" prints "1–6. Very."
 * for every d6 result — read literally rather than smoothed into a
 * fabricated spread; it reads like an intentional one-note joke table. */
export const CYBORG_DEBT = {
  formula: '3d6×1,000¤',
  wantItBack: 'Very.',
  creditors: [
    'A crime syndicate.',
    'An anonymous hacker collective.',
    'Your distant relative, a corrupt politician’s assistant.',
    'A gang run by your childhood bully.',
    'An unknown benefactor signing their messages with YN.',
    'A death cult run by a board member from a powerful corp.',
    'A roadrunner clan who may request services and housing as long as the debt is unpaid.',
    'The owner of a seedy club or dive bar.',
    'A fixer with cops on their payroll.',
    'Someone you trust, hospitalized with increasing medical bills.',
    'A semi-sentient AI cluster slowly building up its influence.',
    'A small but extremely violent SecCorp.',
  ],
}

/** p.79. `d2` is the default Glitches die — a class's own die (below)
 * overrides it. Spend a Glitch to: deal max damage with one attack;
 * reroll a die (yours or someone else's); lower damage taken by d6;
 * neutralize a Crit or Fumble; or -4DR one test (before rolling). Regain
 * the die's-worth again once all Glitches are spent and you've rested. */
export const CYBORG_GLITCH_USES = [
  'Deal maximum damage with one attack',
  'Reroll a dice (yours or someone else’s)',
  'Lower damage dealt to you by d6',
  'Neutralize a Crit or Fumble',
  '−4DR to one test (before rolling)',
]

/** p.38, "Make a Punk" — every character, any class, starts with this
 * before anything class-specific. */
export const CYBORG_UNIVERSAL_START = {
  money: '2d6×10¤',
  items: ['Cheap clothes', 'Retinal Com Device (RCD) — your interface with tech; it can be hacked.'],
}

/** p.39, "Cash & Gear — roll once on each table." Three independent
 * rolls (d8 personal item, d12 gear, d12 drug/tech), on top of the
 * universal money+clothes+RCD above and whatever the chosen class grants
 * separately. */
export const CYBORG_RANDOM_GEAR = {
  personalItem: [
    'Mirrorshades.',
    'CWPC Metro card, d8 trips left.',
    'Hangover.',
    'Pack of realTobacco™ smokes.',
    'd4+1 flashbangs, test Toughness DR14 or +4DR on everything for d4 rounds.',
    'd4 hand grenades, d6 damage to up to d3 targets.',
    'Old-school motorcycle. Fuel is hard to come by.',
    'Stolen taxi. Faked or removed transponders. May trigger alarms when entering high-sec areas.',
  ],
  gear: [
    'Paracord, 30m.',
    'Micro torch cutter, power for d4 uses.',
    'Bio/ID scanner, can track a person within 50m.',
    'Breathing mask, provides oxygen in gas or underwater.',
    'Collapsible ladder, 5m.',
    'First aid kit, d3 uses. Stops bleeding/infection and heals d6 HP.',
    'Crowbar, d4 damage.',
    'Superlube.',
    'Grappling-hook crossbow, d4 damage.',
    'Small bottle of pulverized acid.',
    'Crime scene kit.',
    'Random cybertech (roll d10 on the Cybertech table).',
  ],
  techOrDrug: [
    'Red-juice stimjector, d4 doses. Heals d10 HP.',
    'Adrenachrome_HST, d3 doses. Heals d6 HP, +1 on all abilities d6 rounds, then −1 until rest.',
    'Drone suit. Slow but quiet flight. Attack and defense tests are +4DR while flying.',
    'Small but jailbroken Robo-K9. d6+2 HP, bite d4, only obeys you.',
    'Tiny surveillance drone, 300m range.',
    'Optic camo suit.',
    'Noisemaker. Floods 20m area with fake data for d4 minutes, making remote communication and surveillance impossible.',
    'Fake ID. Good enough to pass a random check, might not work if they are looking for you.',
    'Visionvisor. Zoom, camera, heat/night vision, ultrasound.',
    'Random cybertech (roll d10 on the Cybertech table).',
    'Cyberdeck with d3 slots and 2 random Apps.',
    'A random Nano power.',
  ],
}

export interface CyborgAbilityReroll {
  ability: CyborgAbility
  /** Signed modifier applied to the 3d6 sum before reading the score
   * table, e.g. 2 for "roll 3d6+2." */
  modifier: number
  /** The class's own name for this reroll instruction, when it has one
   * (e.g. "WEIRD", "CUTTING EDGE") — shown as a small label; falls back
   * to just the ability name when the book doesn't name it. */
  tag?: string
}

export interface CyborgLevelFeature {
  tier: 'I' | 'II' | 'III' | 'IV'
  name: string
  effect: string
}

export interface CyborgClass {
  key: string
  name: string
  /** Printed page (this book’s numbering, not the PDF’s — see the
   * grounding doc for the +4 offset). */
  page: number
  blurb: string
  /** Display text, e.g. "Toughness+d4". `hpDie` below is the same die as
   * a plain number so the builder can roll it without parsing this
   * string. */
  hpFormula: string
  hpDie: number
  /** Die SIZE for the Glitches pool (2 = d2, 3 = d3...) — overrides
   * `CYBORG_GLITCHES_DEFAULT` for this class. */
  glitchesDie: number
  abilityRerolls: CyborgAbilityReroll[]
  /** Prose description of what the class grants beyond the universal
   * starting gear — cybertech/App/Nano swaps, weapon dice, debt
   * surcharges. Never a fabricated table — anything the book names as a
   * specific roll table this pass couldn't reliably transcribe is called
   * out in `gearRollNote` instead of invented here. */
  gearGrant: string
  /** Set only when the class's own text references a roll table (e.g.
   * "roll d6 for weapon") that this extraction pass didn't reliably
   * capture — shown to the player as an honest "roll on your class's own
   * table in the book" pointer rather than a fabricated list. */
  gearRollNote?: string
  /** Only Forsaken Gang-Goon has these — features unlocked at character
   * levels 1–4. Every other class's page has no leveled-feature table. */
  levelFeatures?: CyborgLevelFeature[]
  /** One or two of the class's own flavor/backstory d6 tables, kept as
   * free text (not modeled as pick-one-of-six controls, matching how
   * Shadowdark's `backgroundText` also allows free typing) — shown as
   * inspiration, not a hard requirement. */
  flavorPrompts: string[]
}

/** p.42–53. Six classes, each a 2-printed-page spread. No ancestries,
 * alignment, or deities — the earlier `RulesModule`-shape mismatch that
 * triggered this whole separate-types decision. */
export const CYBORG_CLASSES: CyborgClass[] = [
  {
    key: 'shunned-nanomancer',
    name: 'Shunned Nanomancer',
    page: 42,
    blurb: 'It’s inside you. Infesting your brain, warping your flesh. People are afraid of you now — afraid of the power that poisons you. You’re scared too.',
    hpFormula: 'Toughness+d4',
    hpDie: 4,
    glitchesDie: 2,
    abilityRerolls: [
      { ability: 'presence', modifier: 2, tag: 'WEIRD' },
      { ability: 'toughness', modifier: -2, tag: 'ILL' },
    ],
    gearGrant: 'Start with one random Nano power. Any starting App or Cybertech is replaced with a random Nano.',
    gearRollNote: 'Roll d6 for weapon and d2 for armor on the class’s own table (not transcribed here) — pick from the Shop instead, or roll on the book.',
    flavorPrompts: [
      'You got infected when… (a wild night with neo-pagan cultists; a star fell close to your building and you were a curious child; you found drugs that were neither drugs nor entirely free; you were kidnapped and subjected to horrible experiments; a G0 rat bit you; you were born this way.)',
      'You also have one of these: a strange leaf-looking knife; milkwhite eyes that see through lies; burnt orange, stone-like skin; a second mouth where your navel used to be; an elongated, semi-translucent skull; scales covering most of your body.',
    ],
  },
  {
    key: 'burned-hacker',
    name: 'Burned Hacker',
    page: 44,
    blurb: 'You built the deck. You broke the ice. Then you got burned — fried by the last dive you should never have taken.',
    hpFormula: 'Toughness+d6',
    hpDie: 6,
    glitchesDie: 2,
    abilityRerolls: [
      { ability: 'knowledge', modifier: 2, tag: 'CUTTING EDGE' },
      { ability: 'strength', modifier: -1, tag: 'UNHEALTHY LIVING' },
      { ability: 'toughness', modifier: -1, tag: 'UNHEALTHY LIVING' },
    ],
    gearGrant: 'Start with a cyberdeck (Knowledge+4 App slots) and a random App. Any rolled Nano or Cybertech is replaced with a new random App. 6d10×1¤ debt on top of your usual Debt roll.',
    gearRollNote: 'Roll d8 for weapon and d2 for armor on the class’s own table (not transcribed here) — pick from the Shop instead, or roll on the book.',
    flavorPrompts: [
      'You built an App (e.g. Borgtrigga-0.5: provokes a Cy-rage test in one nearby target).',
      'On a deep dive, you’ve found a terrible truth (e.g. the public faces of the UCS board are fabricated — they don’t exist).',
    ],
  },
  {
    key: 'discharged-corpkiller',
    name: 'Discharged CorpKiller',
    page: 46,
    blurb: 'A Corp soldier, once. Now discharged — dishonorably, or just inconveniently. Either way, they want you dead and you’re not sure why yet.',
    hpFormula: 'Toughness+d8',
    hpDie: 8,
    glitchesDie: 2,
    abilityRerolls: [
      { ability: 'knowledge', modifier: -1, tag: 'Emotionally scarred jarhead' },
      { ability: 'presence', modifier: -1, tag: 'Emotionally scarred jarhead' },
      { ability: 'toughness', modifier: 2, tag: 'Tough as nails' },
    ],
    gearGrant: 'Roll d4+1 for armor. Autofire tests are always −1DR. The Corp wants you dead.',
    gearRollNote: 'You took something from your employer when you left the force — roll on the class’s own d6 heavy-weapon table (not transcribed here; e.g. an old-school heavy machine gun, d12a damage) or pick from the Shop.',
    flavorPrompts: ['Your deployment — where were you stationed, and what happened there?'],
  },
  {
    key: 'orphaned-gearhead',
    name: 'Orphaned Gearhead',
    page: 48,
    blurb: 'People are unreliable — socially, physically, emotionally. Weak bodies and weaker wills. Machines, you can trust.',
    hpFormula: 'Toughness+d8',
    hpDie: 8,
    glitchesDie: 4,
    abilityRerolls: [
      { ability: 'knowledge', modifier: 2, tag: 'ENGINEER' },
      { ability: 'presence', modifier: -2, tag: 'PREFERS MACHINES' },
    ],
    gearGrant: 'Test Knowledge DR10 to repair a piece of tech or pilot a vehicle/drone/other machine. You pilot (roll d6): a semi-autonomous quad-bot (bites d4, Knowledge+d8 HP, −d2 Armor); a flying drone (Knowledge+d12 HP, −d6 Armor, assault rifle d8a); three fly-sized surveillance drones (fragile); a prototype crawler drone with a laser turret d12a (Knowledge+d10 HP, −d6 Armor); an armored van with a smuggler’s hatch; or a walking weapons platform with a 2d10 anti-materiel battery.',
    flavorPrompts: ['You trusted them, and then they… (disappeared in G0; were proclaimed dead but you know their soul lives on inside something else; were dragged off to a Corp blacksite; left you to join a roadrunner outfit; got laid up, comatose in a Central Cy hospital.)'],
  },
  {
    key: 'renegade-cyberslasher',
    name: 'Renegade Cyberslasher',
    page: 50,
    blurb: 'You are death incarnate — a frenzied flurry of chrome, murder and blood-stained steel. You used to kill for a cause. Now? You kill for money.',
    hpFormula: 'Toughness+d10',
    hpDie: 10,
    glitchesDie: 3,
    abilityRerolls: [
      { ability: 'strength', modifier: 1, tag: 'BODY AND SOUL' },
      { ability: 'presence', modifier: 1, tag: 'BODY AND SOUL' },
      { ability: 'knowledge', modifier: -2, tag: 'NOT A READER' },
    ],
    gearGrant: 'Start with one d12 roll for a random Cybertech. Replace any App or Nano with another d12 Cybertech roll.',
    gearRollNote: 'Your trenchcoat hides most of your weapon — roll on the class’s own d6 melee-weapon table (not transcribed here; e.g. an ancient blade that deals double damage if you strike first) or pick from the Shop.',
    flavorPrompts: ['You try to start each day with… (yoga and meditating; a mix of stimulants; minding your favorite plants; obsessively laying out your clothes.)'],
  },
  {
    key: 'forsaken-gang-goon',
    name: 'Forsaken Gang-Goon',
    page: 52,
    blurb: 'You ran with the only gang to have your back and treat you like more than slum trash. They’re gone now, so you have to keep your edge.',
    hpFormula: 'Toughness+d6',
    hpDie: 6,
    glitchesDie: 3,
    abilityRerolls: [{ ability: 'strength', modifier: -2, tag: 'Small' }],
    gearGrant: 'Stealthy — all Presence and Agility tests are −2DR.',
    gearRollNote: 'Roll d6 for weapon and d2 for armor on the class’s own table (not transcribed here) — pick from the Shop instead, or roll on the book.',
    levelFeatures: [
      { tier: 'I', name: 'Hits', effect: 'When attacking from surprise, test Agility DR10. On a success, you hit once with a melee weapon, dealing normal damage +3.' },
      { tier: 'II', name: 'Brawls', effect: 'Test Agility DR14 to sucker punch an opponent in melee. Deal normal damage and give all allies −2DR on their next attack against the same enemy.' },
      { tier: 'III', name: 'BnE', effect: 'Test Agility DR10 to pick any mechanical lock, or Knowledge DR10 for any electronic lock. You begin with toolsets for both.' },
      { tier: 'IV', name: 'Fencing', effect: 'Once per day, test Presence DR12 to remember the name of a person in Cy who might be willing and able to buy whatever illicit goods have fallen into your hands.' },
    ],
    flavorPrompts: ['Your gang… (was taken out by a rival gang, who think you’re dead too; got hauled off — cops thought you were just a punk kid, nobody ratted you out.)'],
  },
]

export function getCyborgClass(key: string | null): CyborgClass | null {
  return CYBORG_CLASSES.find((c) => c.key === key) ?? null
}
