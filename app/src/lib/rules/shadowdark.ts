// lib/rules/shadowdark.ts
//
// The Shadowdark RPG rules module — every table here is transcribed
// directly from `Shadowdark_RPG_-_V4-9_compressed.pdf` (core) and the
// three Cursed Scroll supplements already in this project (Diablerie,
// Red Sands, Midnight Sun), not invented. Where a supplement's data
// wasn't fully transcribed (a class's complete tier-1 spell list, a
// Patron Boon table), the field is left absent/null rather than
// fabricated — see each class's own comment and `RulesSpellcasting`'s
// doc comment in `./types.ts` for the specific gaps.
//
// Scope, per the owner's call (2026-08-11): all four core classes plus
// every class in the three Cursed Scroll supplements already in this
// project — the campaign's own party already uses two of them (LaLa is
// a Witch, Kimbo is a Knight of St. Ydris, both Diablerie), so a
// core-only builder couldn't even recreate the existing party.
//
// Leveling-tier data (titles past level 1-2, HP-die progression past
// 1st level, spells-known-by-level tables) is out of scope — see
// `RulesModule`'s own doc comment.

import type { RulesModule } from './types'

export const SHADOWDARK: RulesModule = {
  id: 'shadowdark',
  label: 'Shadowdark',

  statMethod: {
    formula: '3d6',
    order: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    rerollRule:
      "If none of your six scores is 14 or higher, you may reroll the entire set once (rulebook pg. 15).",
  },

  abilityModifierTable: [
    { min: 1, max: 3, mod: -4 },
    { min: 4, max: 5, mod: -3 },
    { min: 6, max: 7, mod: -2 },
    { min: 8, max: 9, mod: -1 },
    { min: 10, max: 11, mod: 0 },
    { min: 12, max: 13, mod: 1 },
    { min: 14, max: 15, mod: 2 },
    { min: 16, max: 17, mod: 3 },
    { min: 18, max: 99, mod: 4 },
  ],

  ancestries: [
    {
      key: 'dwarf',
      name: 'Dwarf',
      languages: ['Common', 'Dwarvish'],
      talent: 'Stout. Start with +2 HP. Roll hit points per level with advantage.',
    },
    {
      key: 'elf',
      name: 'Elf',
      languages: ['Common', 'Elvish', 'Sylvan'],
      talent: 'Farsight. +1 bonus to attack rolls with ranged weapons or +1 bonus to spellcasting checks.',
    },
    {
      key: 'goblin',
      name: 'Goblin',
      languages: ['Common', 'Goblin'],
      talent: "Keen Senses. You can't be surprised.",
    },
    {
      key: 'half-orc',
      name: 'Half-Orc',
      languages: ['Common', 'Orcish'],
      talent: 'Mighty. +1 bonus to attack and damage rolls with melee weapons.',
    },
    {
      key: 'halfling',
      name: 'Halfling',
      languages: ['Common'],
      talent: 'Stealthy. Once per day, you can become invisible for 3 rounds.',
    },
    {
      key: 'human',
      name: 'Human',
      languages: ['Common', 'one additional common language'],
      talent: 'Ambitious. You gain one additional talent roll at 1st level.',
      bonusTalentRolls: 1,
    },
  ],

  classes: [
    // ── Core ──────────────────────────────────────────────────────
    {
      key: 'fighter',
      name: 'Fighter',
      source: 'Core',
      blurb: 'Blood-soaked gladiators, acrobatic duelists, or far-eyed elven archers who carve their legends with steel and grit.',
      weapons: 'All weapons',
      armor: 'All armor and shields',
      hpDie: 8,
      features: [
        'Hauler. Add your Constitution modifier, if positive, to your gear slots.',
        'Weapon Mastery. Choose one type of weapon (e.g. longswords) for +1 to attack and damage with it; add half your level to these rolls (round down).',
        'Grit. Choose Strength or Dexterity — advantage on checks of that type to overcome an opposing force.',
      ],
      talentTable: [
        { roll: '2', effect: 'Gain Weapon Mastery with one additional weapon type' },
        { roll: '3-6', effect: '+1 to melee and ranged attacks' },
        { roll: '7-9', effect: '+2 to Strength, Dexterity, or Constitution stat' },
        { roll: '10-11', effect: 'Choose one kind of armor — you get +1 AC from that armor' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Squire', chaotic: 'Knave', neutral: 'Warrior' },
    },
    {
      key: 'priest',
      name: 'Priest',
      source: 'Core',
      blurb: 'Crusading templars, prophetic shamans, or mad-eyed zealots who wield the power of their gods to cleanse the unholy.',
      weapons: 'Club, crossbow, dagger, mace, longsword, staff, warhammer',
      armor: 'All armor and shields',
      hpDie: 6,
      features: [
        'Languages. You know Celestial, Diabolic, or Primordial.',
        "Turn Undead. You know the turn undead spell — it doesn't count toward your known spells.",
        'Deity. Choose a god to serve who matches your alignment. You have a holy symbol for your god (no gear slot).',
        'Spellcasting. You can cast priest spells you know.',
      ],
      talentTable: [
        { roll: '2', effect: 'Gain advantage on casting one spell you know' },
        { roll: '3-6', effect: '+1 to melee or ranged attacks' },
        { roll: '7-9', effect: '+1 to priest spellcasting checks' },
        { roll: '10-11', effect: '+2 to Strength or Wisdom stat' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      spellcasting: {
        ability: 'wis',
        knownAtLevel1: 2,
        spellList: ['Cure Wounds', 'Holy Weapon', 'Light', 'Protection from Evil', 'Shield of Faith'],
      },
      titleAtLevel1: { lawful: 'Acolyte', chaotic: 'Initiate', neutral: 'Seeker' },
      requiresDeity: true,
    },
    {
      key: 'thief',
      name: 'Thief',
      source: 'Core',
      blurb: 'Rooftop assassins, grinning con artists, or cloaked cat burglars who can pluck a gem from the claws of a sleeping demon.',
      weapons: 'Club, crossbow, dagger, shortbow, shortsword',
      armor: 'Leather armor, mithral chainmail',
      hpDie: 4,
      features: [
        'Backstab. Extra weapon die of damage against an unaware target, plus half your level (round down) in additional dice.',
        'Thievery. Advantage on checks to climb, sneak/hide, apply disguises, find/disable traps, and delicate tasks like picking pockets or locks (tools take no gear slots).',
      ],
      talentTable: [
        { roll: '2', effect: 'Gain advantage on initiative rolls (reroll if duplicate)' },
        { roll: '3-5', effect: 'Your Backstab deals +1 dice of damage' },
        { roll: '6-9', effect: '+2 to Strength, Dexterity, or Charisma stat' },
        { roll: '10-11', effect: '+1 to melee and ranged attacks' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Footpad', chaotic: 'Thug', neutral: 'Robber' },
    },
    {
      key: 'wizard',
      name: 'Wizard',
      source: 'Core',
      blurb: 'Rune-tattooed adepts, bespectacled magi, and flame-conjuring witches who dare to manipulate the fell forces of magic.',
      weapons: 'Dagger, staff',
      armor: 'None',
      hpDie: 4,
      features: [
        'Languages. Two additional common languages and two rare languages.',
        'Learning Spells. Permanently learn a wizard spell from a scroll by studying it a day and passing a DC 15 INT check (the scroll is expended either way).',
        'Spellcasting. You can cast wizard spells you know.',
      ],
      talentTable: [
        { roll: '2', effect: 'Make 1 random magic item of a type you choose' },
        { roll: '3-7', effect: '+2 to Intelligence stat or +1 to wizard spellcasting checks' },
        { roll: '8-9', effect: 'Gain advantage on casting one spell you know' },
        { roll: '10-11', effect: 'Learn one additional wizard spell of any tier you know' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      spellcasting: {
        ability: 'int',
        knownAtLevel1: 3,
        spellList: [
          'Alarm', 'Burning Hands', 'Charm Person', 'Detect Magic', 'Feather Fall', 'Floating Disk',
          'Hold Portal', 'Light', 'Mage Armor', 'Magic Missile', 'Protection from Evil', 'Sleep',
        ],
      },
      titleAtLevel1: { lawful: 'Apprentice', chaotic: 'Adept', neutral: 'Shaman' },
    },

    // ── Diablerie (Cursed Scroll 1) ──────────────────────────────
    {
      key: 'knight-of-st-ydris',
      name: 'Knight of St. Ydris',
      source: 'Diablerie',
      blurb: 'Cursed knights who walk the path of St. Ydris the Unholy, the Possessed. They embrace the darkness to fight it.',
      weapons: 'All melee weapons, crossbow',
      armor: 'All armor and shields',
      hpDie: 6,
      features: [
        'Languages. You know Diabolic.',
        'Demonic Possession. 3/day, gain a +1 bonus to your damage rolls that lasts 3 rounds, plus half your level (round down).',
        'Spellcasting. You can cast witch spells you know (progression is slower than a Witch’s — no spells known at 1st level per the Witch Spells Known table).',
      ],
      talentTable: [
        { roll: '2', effect: 'Your Demonic Possession bonus increases by 1 point' },
        { roll: '3-6', effect: '+1 to melee or ranged attacks' },
        { roll: '7-9', effect: '+2 to Strength, Dexterity, or Constitution stat' },
        { roll: '10-11', effect: '+2 to Charisma stat or +1 to witch spellcasting checks' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Arbiter', chaotic: 'Traitor', neutral: 'Brother/Sister' },
    },
    {
      key: 'warlock',
      name: 'Warlock',
      source: 'Diablerie',
      blurb: 'Howling warriors with sharpened teeth, wild-eyed doomspeakers, and cloaked lore-hunters bearing the hidden Mark of Shune.',
      weapons: 'Club, crossbow, dagger, mace, longsword',
      armor: 'Leather armor, chainmail, and shields',
      hpDie: 6,
      features: [
        'Languages. You know either Celestial, Diabolic, Draconic, Primordial, or Sylvan.',
        'Patron. Choose a patron to serve (Cursed Scroll 1, pg. 17) — the source of your supernatural gifts.',
        'Patron Boon. At 1st level, gain a random Patron Boon talent based on your chosen patron (pg. 18 — not transcribed into this builder; note the patron’s name in Background/Notes for now).',
      ],
      talentTable: [
        { roll: '2', effect: 'Roll a Patron Boon from any patron; an unexplained gift' },
        { roll: '3-6', effect: 'Add +1 point to two stats (they must be different)' },
        { roll: '7-9', effect: '+1 to melee or ranged attacks' },
        { roll: '10-11', effect: 'Roll two Patron Boons and choose one to keep' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Favored', chaotic: 'Marked', neutral: 'Chosen' },
    },
    {
      key: 'witch',
      name: 'Witch',
      source: 'Diablerie',
      blurb: 'Cackling crones stooped over cauldrons, chanting shamans smeared in blood and clay, and outcast maidens who see portents and secrets.',
      weapons: 'Dagger, staff',
      armor: 'Leather armor',
      hpDie: 4,
      features: [
        'Languages. You know Diabolic, Primordial, and Sylvan.',
        'Familiar. A small animal (raven, rat, frog…) who serves you loyally and can speak Common — can be the source of your spells for range purposes.',
        'Spellcasting. You can cast witch spells you know.',
      ],
      talentTable: [
        { roll: '2', effect: 'Your Demonic Possession bonus increases by 1 point' },
        { roll: '3-6', effect: '+1 to melee or ranged attacks' },
        { roll: '7-9', effect: '+2 to Strength, Dexterity, or Constitution stat' },
        { roll: '10-11', effect: '+2 to Charisma stat or +1 to witch spellcasting checks' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      spellcasting: {
        ability: 'cha',
        knownAtLevel1: 3,
        // Diablerie pg. 24's full tier-1 witch spell list wasn't
        // transcribed into this module — these three are LaLa's real
        // known spells (an actual imported character, not invented),
        // shown as suggestions; the builder falls back to free-text
        // entry for anything else. See RulesSpellcasting's doc comment.
        spellList: null,
      },
      titleAtLevel1: { lawful: 'Fortune Teller', chaotic: 'Whisperer', neutral: 'Shaman' },
    },

    // ── Red Sands (Cursed Scroll 2) ──────────────────────────────
    {
      key: 'desert-rider',
      name: 'Desert Rider',
      source: 'Red Sands',
      blurb: 'Howling barbarians thundering across the sand, elven spies wielding curved blades atop silvery camels, or silk-wrapped bandits.',
      weapons: 'Club, dagger, javelin, longsword, pike, shortbow, scimitar, spear, whip',
      armor: 'Leather armor, shields',
      hpDie: 8,
      features: [
        'Charge. 3/day, charge into combat by moving at least near before attacking — melee attacks deal double damage that round.',
        'Mount. A common camel or horse that comes when called and never spooks. While riding, both of you get +AC equal to half your level (round down).',
      ],
      talentTable: [
        { roll: '2', effect: 'You can use any rider-bearing creature as your mount' },
        { roll: '3-6', effect: 'You gain +1 to attacks or damage' },
        { roll: '7-9', effect: '+2 to Strength or Dexterity stat, or +1 to melee attacks' },
        { roll: '10-11', effect: 'Gain an additional use of your Charge talent each day' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Outrider', chaotic: 'Bandit', neutral: 'Rat' },
    },
    {
      key: 'pit-fighter',
      name: 'Pit Fighter',
      source: 'Red Sands',
      blurb: 'Blood-soaked warriors circling each other in a roaring arena, scarred desert bandits dueling for the right to lead their gang.',
      weapons: 'All weapons',
      armor: 'Leather armor, shields',
      hpDie: 8,
      features: [
        'Flourish. 3/day, regain 1d6 HP when you hit an enemy with a melee attack.',
        'Implacable. Advantage on Constitution checks to resist injury, poison, or endure extreme environments.',
        'Last Stand. Get up from dying with 1 HP on a natural roll of 18-20.',
        'Relentless. 3/day, when reduced to 0 HP, make a DC 18 CON check (Implacable applies) — on success, go to 1 HP instead.',
      ],
      talentTable: [
        { roll: '2', effect: '1/day, ignore all damage and effects from one attack' },
        { roll: '3-6', effect: 'You gain +1 to melee weapon damage' },
        { roll: '7-9', effect: '+2 to Strength or Constitution stat, or +1 to melee attacks' },
        { roll: '10-11', effect: 'Increase the HP you gain from Flourish by 1d6' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Rookie', chaotic: 'Ruffian', neutral: 'Underdog' },
    },
    {
      key: 'ras-godai',
      name: 'Ras-Godai',
      source: 'Red Sands',
      blurb: 'Black-clad assassins trained from childhood in a hidden desert monastery, gifted sorcerous powers by a legendary black lotus flower.',
      weapons: 'Blowgun, bolas, dagger, razor chain, scimitar, shuriken, spear',
      armor: 'Leather armor',
      hpDie: 6,
      features: [
        'Languages. You know Diabolic.',
        'Assassin. Advantage on checks to sneak and hide; double damage against unaware targets.',
        'Smoke Step. 3/day, teleport to a location you can see within near (no action used).',
        'Black Lotus. Roll one talent on the Black Lotus Talents table.',
      ],
      talentTable: [
        { roll: '2', effect: 'You are trained in the use of poisons' },
        { roll: '3-6', effect: 'Roll an additional talent on the Black Lotus Talents table' },
        { roll: '7-9', effect: '+2 to Strength or Dexterity stat, or +1 to melee attacks' },
        { roll: '10-11', effect: 'Gain an additional use of your Smoke Step talent' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Acolyte', chaotic: 'Acolyte', neutral: 'Acolyte' },
    },

    // ── Midnight Sun (Cursed Scroll 3) ───────────────────────────
    {
      key: 'sea-wolf',
      name: 'Sea Wolf',
      source: 'Midnight Sun',
      blurb: 'Seafaring raiders who prowl the isles for plunder in dragon-headed longboats — fierce berserkers who hope to please their gods with a brave death.',
      weapons: 'Dagger, greataxe, handaxe, longbow, longsword, spear',
      armor: 'Leather armor, chainmail, shields',
      hpDie: 8,
      features: [
        'Seafarer. Advantage on checks related to navigating and crewing boats.',
        'Old Gods. Each day after resting, choose Odin (regain 1d4 HP on a kill), Freya (daily luck token, +1d6 when you spend one), or Loki (advantage to lie/sneak/hide) until your next rest.',
        'Shield Wall. With a shield, use your action for a defensive stance — AC becomes 20 until your next turn.',
      ],
      talentTable: [
        { roll: '2', effect: '1/day, go berserk: immune to damage for 3 rounds' },
        { roll: '3-6', effect: 'Your attacks deal +1 damage' },
        { roll: '7-9', effect: '+2 to Strength or Constitution stat, or +1 to attacks' },
        { roll: '10-11', effect: 'Duality — choose two different Old Gods effects each day' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      titleAtLevel1: { lawful: 'Freefolk', chaotic: 'Rabble', neutral: 'Wanderer' },
    },
    {
      key: 'seer',
      name: 'Seer',
      source: 'Midnight Sun',
      blurb: 'Baleful diviners who reek of smoke and blood. They untangle the whispers of the gods by reading the runes, the bones, and the stars.',
      weapons: 'Dagger, stave, spear',
      armor: 'Leather armor',
      hpDie: 6,
      features: [
        'Destined. Whenever you use a luck token, add 1d6 to the roll.',
        "Omen. 3/day, DC 9 WIS check — on success, gain a luck token (max one at a time).",
        'Spellcasting. You can cast seer spells you know.',
      ],
      talentTable: [
        { roll: '2', effect: 'Learn an additional seer spell from any tier you can cast' },
        { roll: '3-6', effect: 'Gain an additional use of your Omen talent each day' },
        { roll: '7-9', effect: '+2 to WIS or CHA stat, or +1 to spellcasting checks' },
        { roll: '10-11', effect: 'Increase the die category of your Destined talent by one' },
        { roll: '12', effect: 'Choose a talent or +2 points to distribute to stats' },
      ],
      spellcasting: {
        ability: 'wis',
        knownAtLevel1: 1,
        spellList: ['Chant', 'Evoke Rage', 'Potion', 'Trance'],
      },
      titleAtLevel1: { lawful: 'Guide', chaotic: 'Hedge Witch', neutral: 'Fortune Teller' },
    },
  ],

  backgroundTables: [
    {
      key: 'core',
      label: 'Background (core)',
      entries: [
        { roll: 1, name: 'Urchin', detail: 'You grew up in the merciless streets of a large city' },
        { roll: 2, name: 'Wanted', detail: "There's a price on your head, but you have allies" },
        { roll: 3, name: 'Cult Initiate', detail: 'You know blasphemous secrets and rituals' },
        { roll: 4, name: "Thieves' Guild", detail: 'You have connections, contacts, and debts' },
        { roll: 5, name: 'Banished', detail: 'Your people cast you out for supposed crimes' },
        { roll: 6, name: 'Orphaned', detail: 'An unusual guardian rescued and raised you' },
        { roll: 7, name: "Wizard's Apprentice", detail: 'You have a knack and eye for magic' },
        { roll: 8, name: 'Jeweler', detail: 'You can easily appraise value and authenticity' },
        { roll: 9, name: 'Herbalist', detail: 'You know plants, medicines, and poisons' },
        { roll: 10, name: 'Barbarian', detail: 'You left the horde, but it never quite left you' },
        { roll: 11, name: 'Mercenary', detail: 'You fought friend and foe alike for your coin' },
        { roll: 12, name: 'Sailor', detail: 'Pirate, privateer, or merchant — the seas are yours' },
        { roll: 13, name: 'Acolyte', detail: "You're well trained in religious rites and doctrines" },
        { roll: 14, name: 'Soldier', detail: 'You served as a fighter in an organized army' },
        { roll: 15, name: 'Ranger', detail: 'The woods and wilds are your true home' },
        { roll: 16, name: 'Scout', detail: 'You survived on stealth, observation, and speed' },
        { roll: 17, name: 'Minstrel', detail: "You've traveled far with your charm and talent" },
        { roll: 18, name: 'Scholar', detail: 'You know much about ancient history and lore' },
        { roll: 19, name: 'Noble', detail: 'A famous name has opened many doors for you' },
        { roll: 20, name: 'Chirurgeon', detail: 'You know anatomy, surgery, and first aid' },
      ],
    },
    {
      key: 'diabolical',
      label: 'Diabolical Background (Diablerie)',
      entries: [
        { roll: 1, name: 'Hermit', detail: 'The wilds (and its creatures) are your family' },
        { roll: 2, name: 'Outcast', detail: 'You were thrown out for real or supposed crimes' },
        { roll: 3, name: 'Woodborn', detail: 'They found you in the hollow of an oak tree' },
        { roll: 4, name: 'Amnesiac', detail: 'Your past is a haze, but some memories return' },
        { roll: 5, name: 'Haunted', detail: 'A restless spirit wants something from you' },
        { roll: 6, name: 'Fugitive', detail: 'An anonymous savior helped you disappear' },
        { roll: 7, name: 'Feytouched', detail: 'A fairy befriended you in your childhood' },
        { roll: 8, name: 'Witchborn', detail: 'They burned your mother, but spared you' },
        { roll: 9, name: 'Forager', detail: 'You know how to find the edible and the deadly' },
        { roll: 10, name: 'Redeemer', detail: 'You must redeem the name of your kin' },
        { roll: 11, name: 'Marked', detail: 'You carry an eldritch mark. Is it a curse, or a gift?' },
        { roll: 12, name: 'Sacrifice', detail: 'You were to be ritually sacrificed, but escaped' },
        { roll: 13, name: 'Marooned', detail: 'They left you behind, but you refused to die' },
        { roll: 14, name: 'Fallen', detail: 'You fell from grace. Will you atone, or embrace it?' },
        { roll: 15, name: 'Drawn', detail: 'You hear a whispered call and follow it' },
        { roll: 16, name: 'Ascetic', detail: 'People fear you, but seek out your guidance' },
        { roll: 17, name: 'Wolfchild', detail: 'Long ago, you walked into town wearing pelts' },
        { roll: 18, name: 'Healer', detail: 'You understand how life and death intertwine' },
        { roll: 19, name: 'Chosen', detail: 'An eldritch being selected you for a purpose' },
        { roll: 20, name: 'Demonborn', detail: 'An ancestor of yours is a powerful demon' },
      ],
    },
    {
      key: 'nord',
      label: 'Nord Background (Midnight Sun)',
      entries: [
        { roll: 1, name: 'Freed', detail: 'You were a thrall, but escaped or won your freedom' },
        { roll: 2, name: 'Displaced', detail: 'You fled after a rival jarl attacked your village' },
        { roll: 3, name: 'Criminal', detail: 'You were exiled from your village for a crime' },
        { roll: 4, name: 'Drifter', detail: 'You have not yet found a jarl worthy of your loyalty' },
        { roll: 5, name: 'Crop Farmer', detail: 'You toil in the earth and know all plants' },
        { roll: 6, name: 'Livestock Farmer', detail: 'You have intuition about all animals' },
        { roll: 7, name: 'Hunter', detail: 'You know how to move quietly in the wilds' },
        { roll: 8, name: 'Fisher', detail: 'You know all the sea creatures and legends' },
        { roll: 9, name: 'Enforcer', detail: "You enforce the jarl's law in your village" },
        { roll: 10, name: 'Trader', detail: 'You have mercantile connections in every village' },
        { roll: 11, name: 'Crafter', detail: 'You can make and fix any utilitarian item' },
        { roll: 12, name: 'Bowyer', detail: 'You can make and fix any bow or arrow' },
        { roll: 13, name: "Seer's Apprentice", detail: 'You know some of the mystic arts' },
        { roll: 14, name: 'Shipwright', detail: 'You know how to build and repair longboats' },
        { roll: 15, name: 'Blacksmith', detail: 'Weapons, armor, horseshoes; you do it all' },
        { roll: 16, name: 'Far Traveler', detail: 'You know many distant people and customs' },
        { roll: 17, name: 'Skald', detail: 'You are a poet and know all the ancient ballads' },
        { roll: 18, name: 'Heroborn', detail: 'You are the descendant of a famous warrior' },
        { roll: 19, name: 'Nobleborn', detail: 'You are the child of a jarl, or (rarely) a king' },
        { roll: 20, name: "God's Blood", detail: 'You are descended from a god; it marks you' },
      ],
    },
    // Red Sands (Cursed Scroll 2) doesn't have its own background
    // table in this project's copy — its classes use the core table
    // above rather than a fabricated desert-themed one.
  ],

  alignments: [
    { key: 'Lawful', blurb: 'Fairness, order, and virtue — a "good of the whole" mentality.' },
    { key: 'Neutral', blurb: 'Balance between Law and Chaos — a "nature must take its course" mentality.' },
    { key: 'Chaotic', blurb: 'Destruction, ambition, and wickedness — a "survival of the fittest" mentality.' },
  ],

  deities: [
    { name: 'Saint Terragnis', alignment: 'Lawful', blurb: 'A legendary knight, embodiment of righteousness and justice.' },
    { name: 'Madeera the Covenant', alignment: 'Lawful', blurb: 'The first manifestation of Law; carries every law of reality.' },
    { name: 'Gede', alignment: 'Neutral', blurb: 'God of feasts, mirth, and the wilds; worshipped by many elves and halflings.' },
    { name: 'Ord', alignment: 'Neutral', blurb: 'The Unbending, the Wise, the Secret-Keeper — god of magic, knowledge, and equilibrium.' },
    { name: 'Memnon', alignment: 'Chaotic', blurb: "The first manifestation of Chaos; Madeera's twin." },
    { name: 'Ramlaat', alignment: 'Chaotic', blurb: 'The Pillager, the Barbaric, the Horde — worshipped by many orcs.' },
    { name: 'Shune the Vile', alignment: 'Chaotic', blurb: 'Whispers arcane secrets to sorcerers and witches.' },
  ],

  acFormula: '10 + DEX mod',
  supportsZeroLevel: true,
  zeroLevelGear: {
    rollCount: '1d4',
    table: [
      { roll: 1, item: 'Torch' },
      { roll: 2, item: 'Dagger' },
      { roll: 3, item: 'Pole' },
      { roll: 4, item: 'Shortbow and 5 arrows' },
      { roll: 5, item: "Rope, 60'" },
      { roll: 6, item: 'Oil, flask' },
      { roll: 7, item: 'Crowbar' },
      { roll: 8, item: 'Iron spikes (10)' },
      { roll: 9, item: 'Flint and steel' },
      { roll: 10, item: 'Grappling hook' },
      { roll: 11, item: 'Club' },
      { roll: 12, item: 'Caltrops (one bag)' },
    ],
  },
  firstLevelGoldFormula: '2d6 x 5',
}
