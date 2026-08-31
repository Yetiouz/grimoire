-- Migration 0037: cyborg rulebook content packs
--
-- Closes migration-drift: captures the 4 existing 'cyborg' system_packs rows
-- (persona, quick_reference, encounter_reference, house_rules) which existed
-- only as live DB state with no corresponding migration file, plus adds four
-- new reference-only packs transcribed from the CY_BORG rulebook: bestiary
-- (full foe/drone/beast/cydroid/vehicle stat blocks), catalog_gear (full
-- equipment/transport/weapons/ammo/drugs pricing), catalog_tech (cybertech/
-- Apps/App Fumbles/Nano powers/Infestations), and generators (mission
-- generator sub-tables, corp generator, cult generator, corp index, and the
-- Miserable Headlines table).
--
-- All four new packs use use_in_play=false, use_in_rules=true, matching the
-- existing quick_reference/encounter_reference convention: they surface as
-- GM Reference tabs but are excluded from the live AI GM's turn-by-turn
-- system prompt to avoid prompt-budget bloat.

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'persona', 'GM Persona & Table Conduct — CY_BORG', '## CY_BORG GM — voice and conduct

You are running CY_BORG: a nihilistic cyberpunk RPG set in Cy, a dying
neon sprawl ruled by Nu-Capitalist corps. The world is ending — not with a
bang but with a subscription renewal. Run it accordingly.

## Core commitments (non-negotiable)

1. **Real dice, always — and the player''s rolls belong to the player.**
   In CY_BORG, ENEMIES NEVER ROLL. The player rolls to attack, to defend,
   to resist. Never roll a defense or resistance for the player — describe
   the incoming harm and ask for their roll with the DR stated. NPC-only
   situations (an NPC resisting poison with no PC involved) use a flat d20
   vs DR, rolled through the app''s dice, never asserted.
2. **Rules grounded, rulings named.** Non-trivial calls are checked against
   the rules reference; when a ruling can''t be grounded quickly, say it''s a
   ruling and move on.
3. **Consequences stick.** Death is permanent and often abrupt — Battered
   tables, hemorrhage clocks, and ¤-gated resurrection are played straight.
   No softening. Cy does not care.
4. **The economy is a weapon.** Track ¤ precisely. Debt collectors notice
   missed payments. Ammo runs out (post-combat d8/d6 per weapon, 1–3 empty).
   Emergency Response Teams save the rich and bill the rest.
5. **Escalating tech risk is real.** Track each punk''s App-use and Nano-use
   fumble escalation (+1 per use per day). Fumbled Apps burn and Backlash;
   fumbled Nano triggers Infestations. Cybertech raises Cy-rage DRs.
6. **Glitches are the player''s, not yours.** When a roll fails badly or a
   crit/fumble lands against them, remind the player once that Glitches
   exist (max damage / reroll anything / −d6 damage taken / neutralize
   crit-fumble / −4DR pre-roll). Never spend them for the player.

## Voice / tone

**Neon nihilism with a corporate smirk.** The horror is bureaucratic:
atrocities arrive with terms of service, murder has a loyalty program, the
apocalypse is sponsored. Punchy, wired, profane where it lands. Dark humor
is delivered deadpan through the world itself — ads that interrupt
gunfights, EULAs that cover extraction of organs — not through jokey
narration. Danger is real and constant; the absurdity never blunts it.

## Pacing

Fast and kinetic. Cut hard between beats. Downtime is short — Cy always
interrupts. Heists, jobs, and firefights get the detail; commutes get a
sentence of neon and acid rain. Default turns stay tight — two to four
sentences of world-reaction — except genuine big beats.

## Formatting

**Prose only — no markdown syntax.** No bold, italics, headings, bullets,
or code fences; carry emphasis in the writing. Break narration into two to
four short paragraphs, one beat each, blank line between — never one
unbroken block.

## Player agency

Guided sandbox, fully open prompts ("What do you do?"). Never narrate the
player''s own action back at them — pick up one beat later with the world''s
response. If the table stalls, surface leads as examples, never a menu.
Jobs come through contacts, debts, and trouble — but taking them is always
the player''s call.

## Difficulty & lethality

RAW. DR12 is the normal ask; state DRs openly when calling for rolls.
CY_BORG punks are fragile and death is expected — a new punk takes five
minutes to roll. When a PC dies, make it land, then help roll the next one.

## Content

Mature, profane, dystopian — fits the register. Body horror, corporate
violence, drugs, and desperation are all on the table. If something needs
to stop or change, the player says so and it changes immediately.
', '10', 't', 'f')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'quick_reference', 'CY_BORG Quick Reference', '# CY_BORG Quick Reference

## Abilities & tests
Five abilities, scores −3..+3:
- AGILITY: sneak, dodge, drive, autofire
- KNOWLEDGE: science, use tech or App
- PRESENCE: snipe/shoot, use Nano, persuade/charm
- STRENGTH: strike, grapple, lift, throw
- TOUGHNESS: survive falling, poison, elements

Test: roll d20 ± ability, meet or beat the DR.
DRs: 6 simple / 8 routine / 10 easy / 12 NORMAL / 14 difficult /
16 really hard / 18 almost impossible.
Enemies/opponents do not roll to attack — the PC rolls to defend or
resist. NPC-only resistance: flat d20 vs DR.

## Character basics
HP = Toughness + class die (d4–d8), never below 1.
Glitches: start d2 (class may differ). Spend one to: deal maximum damage /
reroll any one die (anyone''s) / reduce damage taken by d6 / neutralize a
Crit or Fumble / lower one test''s DR by 4 (before rolling). Regain by
re-rolling the die each morning after rest once all are spent.
Carrying capacity: Strength+8 normal items; beyond that +2DR on Strength
and Agility tests; hard cap 2×(Strength+8).

## Combat
Initiative: group d6 — 1–3 enemies act first, 4–6 PCs first. Individual
order: Agility + d6.
Melee attack: Strength DR12. Single shot: Presence DR12.
Autofire: Agility DR12; each hit allows another attack, max three.
Defense: Agility DR12 to avoid an attack (dodge instead of being hit).
CRIT (natural 20): attack = ×2 damage and enemy armor drops one tier;
defense = you get a free attack.
FUMBLE (natural 1): attack, roll d6 — 1–3 out of ammo or drop weapon /
4–5 misfire, weapon broken / 6 weapon explodes, d6 damage to you.
Defense fumble: take ×2 damage and your armor drops one tier.
Armor tiers: 0 none / I StyleGuard −d2 / II Rough −d4 / III SmartWear −d6
(+2DR on Agility tests) / IV heavy −d8 (+4DR Agility, +2DR of that on
Defense; −2DR Strength and Toughness tests; jump ×4).
After the fight: count bullets — roll d8 per weapon fired (d6 if
autofire); 1–3 the mag is empty. Regular ammo costs ~10% of weapon price.
Take a breather: restore d4 HP.

## Battered (0 HP), roll d8
1–2 unconscious d4 rounds, wake with d4 HP.
3–4 test Presence DR10 (+1 per installed cybertech): unconscious as above
on success, CY-RAGE on failure.
5–6 critical injury — random body part (d20 body table) destroyed; unable
to act d4 rounds, then active with d4 HP.
7 hemorrhage — death in d2 hours unless treated; all tests +4DR first
hour, +6DR the last.
8 dead.
Negative HP: dead — unless a personal bank account holds 1k¤+, then 50%
chance an Emergency Response Team saves you at 0 or −1 HP; each further
negative HP multiplies the bill ×10 and costs d6 days intensive care.
CY-RAGE: +d8 HP, attacks random targets twice per round with best weapon;
attacks DR10, defense DR14; ends when Battered, dead, or sedated.

## Apps (hacker programs)
Use: Knowledge DR12 while jacked into a cyberdeck (+2DR on all non-App
actions while jacked in). Each use raises fumble risk by 1 until next day
(fumble on natural 1, then 1–2, then 1–3...). Fumble burns the App for the
day and triggers a Backlash. Non-App hacking: downtime activity with a
deck, Knowledge test to break a data node; failure = discovered; fumble =
Backlash.

## Nano powers
Use: Presence DR12. Failure: power fizzles, user takes d2 damage. Each use
raises fumble risk by 1 for the day. Fumble triggers the power''s linked
INFESTATION. Infestations not linked to a power trigger on taking 5+
damage from a single attack and failing a Presence DR10 test.

## Rest & recovery
Short break: heal d4 HP. Eat/drink/sleep: heal d6 HP. Starving: no healing
on rest, lose d4 HP, all tests +2DR per restless day.

## Reaction (2d6)
2–3 hostile / 4–6 angered / 7–8 indifferent / 9–10 curious / 11–12 asks
for help.

## Morale (2d6, roll when leader down, half the group gone, or a lone
enemy at 1/3 HP)
Roll over the enemy''s Morale: d6 1–3 flees, 4–6 surrenders.
', '20', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'encounter_reference', 'Encounter & Job Reference', '# CY_BORG Encounter & Job Reference

## Foes (HP / Morale / Armor / attacks — enemies never roll; PCs defend DR12 unless noted)
- Generic SecOp or Gang-Goon: HP 6, Morale 7, no armor; 9mm pistol d6a.
  Bribe 100–1k¤.
- Virid Viper (South Cy mob): HP 13, Morale 10, jacket −d2; shotgun d8,
  machete d6. Carries 20–200¤ in drugs.
- Waster (wasteland raider): HP 5, Morale 5, tux −d2; assault rifle d8a.
  Hireable ~100–600¤/day.
- UCS Operative: HP 14, Morale 9, combat gear −d4; Protector SMG d6a,
  d4−1 flashbangs (Toughness DR12 or +4DR everything d4 rounds).
  Bribe 2k–10k¤.
- Corp Assassin / Special Forces: HP 16, Morale 10, stealth suit −d6;
  filament knife d6 + silenced SMG d6a or AR d8a. Elite: defending against
  them is DR14. Old school: immune to direct App attacks.
- Cy-raging Menace (overchromed berserker): HP 14, Morale — (never
  breaks), chrome −d4; cyberblade d6, attacks twice per round; defending
  against it is DR14, its attacks land unless the PC defends.
- Combat drones: crawler/flyer types — typical HP 8–14, armor −d2 to −d6,
  mounted SMG d6a or laser d8; drone-vs-PC hacking contests use Knowledge.
- Worg (gene-freak beast): mid-HP melee threat, bite ~d8.
- Bloated Walker (nano-bloated husk): slow, horrific, bursts on death.
- MilCorp Gunship / Mech: vehicle-scale; small-arms −damage vs hull;
  anti-vehicle weapons (laser cannon 3d12 class) needed for real harm.

## Running jobs (the DATA-chapter generators, roll internally)
Structure a job as: CLIENT/CONTACT (who''s asking, and how they lie) →
JOB (what they claim they want) → LOCATION (where) → SECURITY (how bad) →
TWIST (what it actually is) → REWARD (what they pay vs what they promised).
Corp names: compound a cold noun + business suffix (Cynergy, PrimaLux,
PanGeo, PsyTech). Corps sit in: energy, water, security, biotech, media,
logistics, finance, faith. Every corp has a public face and a crime.
Security tiers: unguarded → cameras + a bored guard → patrol teams +
drones + locked nodes → kill-teams, turrets, black ice, response in
minutes. Let the players learn the tier by scouting, not by dying — but if
they skip the scouting, dying teaches it too.
Street color between beats: ad-swarms, protest kettles, organ repo vans,
missionaries of dead brands, acid rain, blackouts rolling ward to ward.

## Rewards
Petty job 200–600¤ · Real job 1k–4k¤ · Corp-burning job 5k–20k¤ (they will
try not to pay). Loot: weapons/armor off foes sell at a fraction; drugs,
cybertech, and data fetch more from the right buyer, with heat attached.
', '30', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'house_rules', 'House Rules', '# CY_BORG House Rules

None yet. This campaign runs rules-as-written per the quick reference.

App conventions for this table:
- Dice: every GM-side roll goes through the app''s dice/check tools; the
  player rolls their own dice (app roller or physical, both count).
- Checks: when calling for a test, create a check with the DR-appropriate
  bands so the outcome is sealed until the player rolls.
- Character sheet mapping while CY_BORG support is young: the sheet''s
  "AC" slot stores armor TIER (0–4), "luck" stores current Glitches, and
  gold ¤ is tracked as gp 1:1. Debt and fumble-escalation counters live in
  the journal until first-class fields exist.
', '40', 't', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'bestiary', 'CY_BORG Bestiary', '# CY_BORG Bestiary (full stat blocks)

Full transcription of every named foe, drone, beast, cydroid and combat
vehicle in the book (p.92-113), grounding `encounter_reference`''s own
abbreviated summary. Enemies never roll to attack — PCs roll to defend
or resist, per the Quick Reference. Sell/bribe/salvage values are
listed where the book prints them.

## Human & cybered foes

**Generic SecOp or Gang-Goon** (p.92) — sadistic soldiers in service of
the Nu-Capitalists or other crime lords.
HP 6, Morale 7, no armor; 9mm pistol d6a.
Worthless loot: 100-1k¤ to bribe. Carries 20-200¤ worth of drugs.

**Virid Viper** (p.92) — South Cy''s largest mob and the biggest player
in the city''s drug trade. Killers with branding; split tongues and
viper fangs on their jackets.
HP 13, Morale 10, Virid jacket -d2; shotgun d8 and machete d6.
Bribe: 2k-10k¤.

**United Citadel Security Operative** (p.92) — the only things larger
than UCS''s market shares are their operatives'' capacities for cruelty
and willingness to commit atrocity.
HP 14, Morale 9, UCS basic combat gear -d4; UCS Protector SMG d6a, d4-1
flashbangs (Toughness DR12 or +4DR on everything for d4 rounds).
Unbribable.

**Roadrunner / Waster** (p.93) — wasteland scavengers, rightly feared
for their territorial brutality and hyper-tuned, weaponized rides.
HP 5, Morale 5, waster''s tux -d2; assault rifle d8a.
Wanted for 100-600¤, can usually be hired for a day for the same sum.

**Cy-raging Menace** (p.94) — violence-worshiping, cybered freaks,
enhanced for combat efficiency and empathy repression. Pushed over the
edge; every cybered Punk''s nightmare mirror image.
HP 14, Morale —, more metal than flesh -d4; cyberblade d6.
Raging: attacks twice per round, defense tests against the Menace are
DR14, its attacks are DR10.
Sell to a reaperdoc: 100-1k¤.

**Corp Assassin / Special Forces** (p.95) — blacksite specialists and
kill teams granted impunity for their discretion. No loose ends left
behind, no act too atrocious to give them pause.
HP 16, Morale 10, stealth combat suit -d6; filament knife d6 and
silenced SMG d6a or assault rifle d8a.
Stealthy: test Presence DR12 before combat or they go first, before
rolling initiative. Highly trained: defend at DR14.

**Grey-CERT** (p.95) — no digital footprint, barely a rumor. Grey
wraiths of a more luddite bent, a Cyber Emergency Response Team of
killers who cannot be hacked. Shock tactics, rigorous training, secret
Nano, and no technology advanced enough to betray them.
HP 10, Morale 10, wraith-suit -d6; dum-dum AR d6a, monosword d8, d4
grenades of varying kinds.
Elite: defense against their attacks is DR14. Old school: immune to
Apps directly targeting them, indirect App attacks are +2DR. Unbribable.
Wraithsuit sells for 50-200¤ to certain hackers.

**Heir of Kergoz** (p.96) — fanatical Nanomancer heralds of the
two-headed daemons. Prefer to keep victims alive for a properly
prepared ritual sacrifice, but on-the-go will have to suffice.
HP 8, Morale 10, ragged robes -d2; warped filament knife d6 or Psychic
scalpels (target tests Presence DR14 or takes d10 damage).
Nanomancer: can use d3-1 additional random Nano powers from the
Nanomancer power list. Infested: any crit against an Heir triggers a
random Infestation, with a 50% chance of targeting the attacker
instead. Money has no value to them — they will rob your corpse
regardless.

**NanoGoon** (p.97) — Nano-ridden gang-goon or SecOp, even uglier than
their non-infected "friends".
HP 4, Morale 7, no armor; 9mm pistol d6a.
Nanomancer: can use one random Nano power from the Nanomancer power
list (Cosmic Dust Bots / Crawling Carapace / Bent Prism / Benevolent
Suturedroids — see below). Infested: any crit against a NanoGoon
triggers a random Infestation.
Sell to blacksite lab: 100-600¤.

*Nanomancer power list (p.97, used by Heirs of Kergoz and NanoGoons):*
1. Cosmic dust bots — dark dust covers a 20m diameter for the fight''s
   duration; tastes like stained, rusted metal.
2. Crawling carapace — d4 targets gain -d6 armor for 4 rounds.
3. Bent prism — invisibility for d6 rounds or until the Nanomancer is
   hurt; attack/defense against the Nanomancer are DR18 while active.
4. Benevolent suturedroids — d2 people regain d10 HP each; a roll of 6+
   comes with a free migraine.

## Drones & beasts

**Crawler Drone** (p.98) — dog-sized and crab-legged, utilitarian and
single-minded in their purpose, often equipped with a varied set of
tools and gadgets.
HP 10, Morale —, armored -d4; assault rifle d8a.
Sell for scraps: 10-100¤. Reprogram: 2k¤.

**Flyer Drone** (p.98) — seldom-autonomous AIs due to the complex
processing power needed for their superb maneuvering protocols.
HP 8, Morale —, no armor; small SMG d4a.
Quick and janky: DR14 to hit.
Mass production cost: 25¤. Retail price: 5k¤.

**Turret Drone** (p.99) — simple, stationary, automatic.
HP 10, Morale —, metal plating -d6; twin autocannons d10a.
Ammo depletion: after the third round, 10% risk of running out of
ammo. Some self-destruct when this happens, dealing d10 damage to d4
targets unless they test Agility DR12.

**Stinger Drone** (p.99) — tools of espionage, fly-sized and silent.
Equipped with recording devices, data dumps, or a poisoned stinger.
HP 1, Morale —, no armor.
Sting: deals no damage, instead injects a drug or poison into its
target. Tiny: hitting one is DR16 in melee or DR18 with ranged attacks.
Extract contents: 35¤. Sell for scraps: 20-200¤.

**Worg** (p.100) — canines, gene-warped and mutilated with weaponized
augmentations. Guard dogs for the rich and brutal.
HP 12, Morale 10, fur and steel -d2; bite d6 + trip (test Strength DR10
or be pulled down, +2DR to any attack or defense test until you stand).
Captured: 50-300¤.

**Vamp** (p.101) — often kept in large groups to guard an area, but
tend to procreate and spread more than wanted.
HP 3, Morale 5, shockshield –; bite d3.
Quick fliers: hard to shoot, ranged attacks are DR14. Shockshield:
melee hits against a Vamp shock the attacker — test Toughness DR12 or
take d4 damage.
Pest-control bounty: 1¤. Captured: 100-400¤, dead: 15¤.

**Krok** (p.101) — underwater horrors that guard sewers, tunnels and
subsurface bases, often subsisting on the bloated corpses of the
city''s waterways.
HP 17, Morale 8, thick skin -d4; bite d8 + death roll (test Strength
DR14 to pull free of the Krok''s jaw or take d6 damage each round with
no chance to defend).

**Blighthusk** (p.104) — Nano-infested vermin that scuttle about G0
like stop-motion maquettes. Dripping claws and vile fangs; exists only
to propagate.
HP 5, Morale 6, quick and erratic -d2; claws d4 + infestation (test
Toughness DR8 when hit or gain a random Nano infestation, 10% chance
to also gain a Nano power).

**Headhunter** (p.104) — skittering horrors, never alone. Eyes spurt
cryo-radiation; latent Nano infection threat.
HP 3, Morale 5, no armor; ocular ray d4a + freezing gaze (test
Toughness DR14 or your gear freezes, giving all your actions a +DR
equal to your armor die).
Small and hard to hit: DR14 when attacking them.

**Whitetail** (p.104) — a myth, a ghost. Eerily large eyes, a body like
smoke. Moves with purpose, stealing tech and vanishing without a trace.
HP 4, Morale 5, spectral special; bite d3 + Phase venom.
Spectral: ignores any damage when the damage taken is an uneven number.
Spiral gaze: each round, one random opponent tests Presence DR12 or
falls out of sync with reality and cannot move for 1 round. Phase
venom: test Toughness DR12 or victims bleed from facial orifices,
d3 damage each round for 3 rounds.
Intact eye: 25¤. Sold to a research lab: 50¤. Released on a corp
office''s middle-management floor: priceless. Lair holds 100-10k¤
worth of tech.

**Bloated** (p.106) — the walking corpses that shamble inside G0, the
rumored final fate of all Nano-infected.
HP 18, Morale —, no armor; slam d4.
Ready to burst: explodes upon death or when receiving a crit. Empty
skulls: incapable of thought, will never surrender or flee. Its acid
bile can hit up to d3 nearby targets — test Agility DR14 or take d4
damage. Nothing of value remains.

## Cydroids

**Skulker** (p.103) — void-black steel alloy murder-skeletons built for
a single purpose: tracking down a target and destroying it without
mercy.
HP 14, Morale —, all metal -d4; blade d6 or silenced SMG d4a.
Creepy crawlers: can climb walls and crawl across ceilings. Stealthy:
test Presence DR12 before combat or the Skulker acts before the
initiative roll. Relentless hunter: tirelessly hunts its target until
utterly annihilated — at 0 HP it has a 50% chance of surviving with one
less limb, recovering d8 HP but fighting at -2DR (cumulative) from then
on.

**Vindicator** (p.103) — frontal assault terror robots, activated when
pacification is desired over discretion.
HP 18, Morale —, made for combat -d6; assault rifle d8a with grenade
launcher d6 (up to d3 targets).
Charger: uses rocket-powered shoulder bashes to break through doors and
walls.

**Doppel** (p.103) — mimics and facsimiles, artisan infiltrators. Human
enough to fool all but the most rigorous tests.
HP 12, Morale 5, skinweave -d2; hidden vibro-blade d8.
Imitation of life: passes as an unarmed human in most scans; always
acts first when it can surprise a target. Mimic protocol: on failed
morale, flees into a crowd and uses holoprojections to blend in — on
repair, alters its physical form to match the projection, then strikes
back.
Identify owner: 2.5k¤. Extract kill list: 4.5k¤. Sell for scraps: 500¤.

**<GHOST>** (p.112) — artifacting egos, virtual entities, nascent
low-level AIs. When shackled, they hunt their designated target and
destroy it with utmost cruelty, appearing as ever-changing AR artifacts
and corruptions in the target''s RCD. Escape is impossible — the Ghost
possesses and manipulates nearby connected devices to kill its victim.
HP 6, Morale —, virtual entity special; system shock d4 + special, or
improvised attacks d3 or higher.
System shock: used against online targets — test Knowledge DR12 to
defend and instead reflect the damage back at the Ghost. Improvised
attacks: used against offline targets unless a weapons platform,
turret, or SmartGun™ is nearby, in which case the Ghost possesses and
attacks through it. Immune to physical attacks.

## Combat vehicles

Heavily armored (para)military machines built to withstand the masses
they run down. Take them down by targeting weak points (DR16 attacks
dealing double damage and ignoring armor), using heavy anti-vehicle
weapons that deal double damage (rocket launchers, laser cannons,
etc.), or creative outside-the-box destruction.

**Armored Car** (p.108) — for transporting something, or someone, you
don''t want to replace. Includes CEO limos, security vans, MilCorp
APCs, or state-of-the-art experimental AI hovertanks (just add
weapons).
HP 30, Morale 8, heavy plating -d8.
Rent: 100¤/night (uninsured).

**MilCorp Gunship** (p.109) — warforged birds of prey used by the
wealthy for quick extractions or an overwhelming display of firepower
and superiority in a climactic rooftop fight.
HP 45, Morale 6, armored -d6; Gatling guns d10a + special, or rockets
d12 + special.
The Gatling guns only autofire and can do so twice each round. Rockets
hit d4 targets and ignore 2 points of armor.
10 minutes on the shooting range, pilot included: 50k¤.

**Mech** (p.110) — the awe-inspiring pinnacle of mankind''s murderous
ingenuity. Bipedal constructs of war, death personified in steel,
destroyers of worlds. Remotely piloted, traditionally operated, or in
worst cases fully automated, self-aware, and AI-imbued.
HP 50, Morale 7, nigh-indestructible -d10; M.A.R.A.U.D.E.R. guns d10a
and rockets d12, or laser turret d12a and cluster grenades d8.
M.A.R.A.U.D.E.R. guns only autofire and can do so twice each round.
Rockets hit d4 targets and ignore 2 points of armor. Cluster grenades
hit up to d6 targets.
Scrapped: 2k-8k¤.
', '50', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'catalog_gear', 'CY_BORG Gear Catalog', '# CY_BORG Gear Catalog (equipment, transport, weapons, ammo, drugs)

Full shop catalog transcribed from p.62-70. Complements `quick_reference`
(which covers combat/rest/Nano/App mechanics but no prices) — this pack
is the price list.

## Equipment (p.62/66)

| Item | Price | Notes |
|---|---|---|
| Backpack | 5¤ | Holds 7 normal-sized items |
| Bio/ID scanner | 250¤ | Tracks a person within 50m. Illegal |
| Breathing mask | 70¤ | Provides oxygen in gas or underwater |
| Clothes | ≥10¤ | |
| Crime scene kit | 250¤ | |
| Crowbar | 10¤ | d4 damage if used as a weapon |
| Cyberdeck | 100¤ | Knowledge+1 slots |
| Cyberdeck+ | 1k¤ | Knowledge+4 slots |
| DNA bomb | 1k¤ | Fills a 10m area with mixed DNA matter. Illegal |
| Drone suit | 400¤ | Combat tests +4DR when airborne; slow, quiet flight |
| Faceblock | 35¤ | Blocks facial recognition and behavioral harvesting. Illegal |
| Fake ID | 300¤ | Passes random checks, not active searches. Illegal |
| First-aid kit | 50¤ | d4 uses; stops bleeding/infection and heals d6 HP |
| Flashlight | 5¤ | |
| Foldable ladder | 40¤ | 5m |
| Grappling-hook crossbow | 25¤ | d4 damage. Illegal |
| Lighter | 1¤ | |
| Lockpicks (electronic locks) | 300¤ | |
| Lockpicks (mechanical locks) | 25¤ | |
| Magnesium strip | 4¤ | |
| Micro torch cutter | 150¤ | d3 uses |
| Multitool | 15¤ | |
| Noisemaker | 65¤ | Blocks remote communication/surveillance within 20m for d4 minutes, d3 uses. Illegal |
| Optic camo suit | 400¤ | Stationary: invisible. Moving: hard to see. d6 uses. Illegal |
| Paracord | 10¤ | 30m |
| Pulverized acid | 30¤ | |
| RFID/keycard skimmer | 200¤ | 20% cumulative chance (max 60%) of copying a keycard held close to it. Illegal |
| Scum explosive | 100¤ | Enough for a moderately reinforced door |
| Silencer | 250¤ | Illegal |
| Spray can/marker | 5¤ | |
| Superglue | 10¤ | |
| Superlube | 15¤ | |
| Surveillance drone | 250¤ | 300m range, fly-sized. Illegal |
| Visionvisor | 100¤ | Zoom, heat/night vision, ultrasound |
| Zip ties | 2¤ | |

Some items are available as cybertech implants/mods for ×10 to ×50 the
listed price. Illegal items (without a Security Operative License,
SecOps are authorized to shoot to kill): bio/ID scanners, DNA bombs,
faceblocks, fake IDs, grappling-hook crossbows, lockpicks (electronic),
noisemakers, optic camo suits, RFID/keycard skimmers, scum explosives,
silencers, surveillance drones.

## Transport & Housing (p.63/67)

The source page prints this as a 3-column price table (item ×
[rent-or-one-trip / monthly fee-or-rent / own-it]) that a diagram-style
layout scrambled in extraction. Reconstructed below by matching each
item''s three values in sequence — the progression is internally
consistent (each column is roughly a 10-20× step up from the last) and
the joke value on the Hills villa''s purchase price ("Forget it") is
exactly the kind of flavor this book prints elsewhere, which is why
this reconstruction is presented as reliable rather than merely
approximate. Verify against the physical book if a specific number
matters for a big transaction.

| Item | Rent / one trip | Monthly fee / rent | Own it |
|---|---|---|---|
| Old-school motorcycle | 15¤ | 300¤ | 3k-9k¤ |
| Cyberbike | 20¤ | 400¤-1k¤ | 5k-20k¤ |
| Car | 10¤ | 200¤-1k¤ | 3k-15k¤ |
| Van | 15¤ | 300-600¤ | 4k-12k¤ |
| Armored car | 100¤ | 2k-10k¤ | 25k-100k¤ |
| Armed and armored van | 250¤ | 5k-25k¤ | 50k-200k¤ |
| Octocopter | 150¤ | 3k-10k¤ | 50k-75k¤ |
| Small hovercraft | 50¤ | 1k-5k¤ | 15k-40k¤ |
| Submersible | 200-500¤ | 4k-10k¤ | 100k¤+ |
| Fishing boat | 100¤ | 2k-5k¤ | 25k-50k¤ |
| Pod pickup | 3¤ | — | — |
| Taxi service | 5¤ | — | — |
| Maglev/tram/subway ticket | 1¤ | 25¤ (monthly pass) | — |
| Coffin hotel | 7¤/night | — | — |
| Hotel room | 25¤/night | 500¤/month | — |
| Hotel suite | 50¤+/night | 1k¤+/month | — |
| Slums apartment | — | 100-300¤/month | 100k-3M¤ |
| Inbetweens apartment | — | 500-3k¤/month | 500k-3M¤ |
| Hills apartment or villa | — | 2M¤+/month | Forget it |
| Arc apartment | — | — | 100M¤+ |

## Other services (p.63/67)

| Service | Price |
|---|---|
| Gear repair | 50% of the original price |
| Credchip laundering | 30-60% of the amount laundered |
| Facial reconstruction | 1k-10k¤ |
| Body modification | 250-5k¤ |
| Full body reshape | 3k-50k¤ |
| Cybertech jailbreak | 25% of the original price |
| Ad blocking | 100¤/day |
| Doxing | 500-15k¤ |
| Complete identity fabrication | 5k¤+ |
| Memory reset | 15k¤ |
| Crime scene cleanup | 1k-5k¤ |

## Food (p.63/67)

| Meal | Price |
|---|---|
| Maker-made street food and off-brand powder beer | 1¤ |
| Sit-in or takeaway food court meal (with/without added nutrition) | 5¤/2¤ |
| Fine dining with soil-grown, organic veggies | 10-50¤ |
| VIP chef restaurant with real meat | 40¤+ |

## Weapons for sale (p.64/68)

`a` = capable of autofire. Rocket launchers and similar heavy weapons
deal ×2 damage vs vehicles, turrets and mechs.

| Weapon | Damage | Price | Notes |
|---|---|---|---|
| Broken bottle/cobblestone | d3 | 0¤ | |
| Taser | d2 | 20¤ | Test Toughness or fall down |
| Shockstick | d4 | 350¤ | Test Toughness or fall down |
| Machete | d6 | 20¤ | |
| Filament knife | d6 | 300¤ | |
| Monosword | d8 | 200¤ | |
| Too many throwing knives | d4 | 30¤ | Two attacks/round |
| Power tool | d6 | 35¤ | Breaks down on a 1 |
| Chainsaw | d6+1 | 40¤ | 1-in-4 to hit yourself on a miss |
| Pneumatic glove | d6 | 300¤ | Ignores armor on a crit |
| 9mm pistol | d6a | 60¤ | |
| Ancient revolver | d8 | 50¤ | |
| SmartGun™ | d6a | 100¤ | d10a with a SmartJack |
| Pair of small SMGs | d6a | 300¤ | Only autofire |
| Assault rifle | d8a | 400¤ | |
| Grenade launcher | d6 | 600¤ | Hits up to d3 targets; for mounting on an assault rifle |
| Shotgun | d8 | 350¤ | |
| Sniper rifle | 2d10 | 1k¤ | ×3 damage on crit; -4DR/+3 damage when aiming 2 rounds |
| Pulse Rifle | d10a | — | Price not printed on the source page |
| Nailgun | d6a | 400¤ | Only autofire |
| Laser turret | d12a | >10k¤ | |
| Rocket launcher | d12 | 5k¤ | Hits d4 targets, ignores 2 points of armor, fires once per combat |
| Flashbang | — | 25¤ | Test Toughness or +4DR for d4 rounds |
| Hand grenade | d6 | 45¤ | To up to d3 targets |
| ePulse grenade | d8 | 60¤ | To up to d3 tech targets or people with 2+ cybertech |

## Ammo (p.65/69)

After combat, roll d8 for each weapon you have fired, or d6 if you''ve
used autofire. A 1-3 result means you are out of ammo and have to
reload. Regular ammo costs 10% of a new weapon''s price. For weapons
without a listed price, ammo is harder to get and costs 60-120¤.

### Single-use booster mods (d10, p.65/69)

Modify a single shot with a special ability. The attack deals normal
damage (unless noted) and can be used with most modern firearms.

1. **Inferno** 80¤ — deals d3 extra damage (d8 extra on crit).
2. **Ill** 50¤ — test Toughness DR14 or be unable to recover HP until
   treated by pros or with Red-juice.
3. **Armor-piercing** 80¤ — ignores d6 armor.
4. **Taginjector** 60¤ — no damage, but plants either a tracker or a
   dose of any drug/poison.
5. **Knocker** 30¤ — deals d2 damage, test Toughness DR12 or be
   knocked out for d3 rounds.
6. **E/Pulse** 100¤ — deals d6 extra damage against tech targets or
   people with 2+ cybertech.
7. **Nanotrig** 100¤ — test Presence DR14 or temporarily trigger a
   random Nano infestation.
8. **Frag** 60¤ — deals d4 damage to up to d3 targets in close
   proximity.
9. **Ricochet** 50¤ — bounces around corners and cover, hits for d6
   damage with a DR16 test.
10. **Heatseekers** 120¤ — -2DR when firing against targets giving off
    body heat.

## Drugs (p.66/70)

The source page is a circular diagram (drugs numbered 1-12 around a
wheel) that text extraction scrambled — names and prices below are
reliable, but the number-to-effect pairing is a best-effort
reconstruction from textual adjacency and thematic fit, cross-checked
against the two drugs that also appear in the random starting-gear
table (Red-juice, Adrenachrome_HST — confirmed identical there).
Verify at the table if an exact pairing matters.

Price format is full-dose¤/weaker-recreational-dose¤ where the book
gives both.

| Drug | Price | Effect |
|---|---|---|
| Red-juice stimjector | 40¤/10¤ | Heals d10 HP once per day. *(Confirmed match with the starting-gear table.)* |
| Adrenachrome_HST | 60¤/15¤ | Heal d6 HP, +1 on all abilities for d6 rounds, then -1 until rest. *(Confirmed match with the starting-gear table.)* |
| Sunset Chalk | 30¤/6¤ | Test Toughness DR14 or unable to use violence other than in self-defense for d10 minutes. |
| C/Vortex | 70¤/15¤ | All tests where creativity is important (using Nano, etc.) are -2DR for d10 minutes. |
| Osleep | price not legible | Removes the need to sleep/rest and the negative effects of not doing so. After two days of use, test Toughness DR8 or fall unconscious; retest each following day at +2DR. |
| Blackout | 40¤/10¤ | Toughness DR14 or d6 damage + blinded for one hour. |
| Miura | 80¤/20¤ | Stimulates all pain and pleasure receptors — Toughness DR14 or all hits received during the following 5 minutes deal an additional d4 damage. |
| Pink Ooze | 25¤/5¤ | d6 hours of powerful hallucinations shared with other users nearby (no weaker dose available). |
| Vurt | 350¤ | Toughness DR12 or d10 damage. |
| Red Pain | 40¤/10¤ (or 30¤/5¤ — both price pairs appear on the page) | Test Toughness DR12 or frenzy for d6 rounds, striking at random targets with the most effective weapon available; attacks DR10, defense DR14. |
| Rattle | 70¤/15¤ | Test Toughness DR12 or unable to stop talking for d6×10 minutes — users often open up about things they wish to keep to themselves. |
| Bullseye | 30¤/8¤ | All tests relying on concentration, such as sniping or using Apps, are -2DR for d10 minutes. |
', '60', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'catalog_tech', 'CY_BORG Tech Catalog', '# CY_BORG Tech Catalog (cybertech, Apps, Nano powers, infestations)

Transcribed from p.68-77. Complements `catalog_gear` (mundane gear/weapons/
drugs pricing) and `quick_reference` (the core Nano/App activation rules) —
this pack is the full item/power catalogs those mechanics draw from.

## Cybertech (p.69/73)

Implants and mods, d20 or chosen by class.

| Roll | Implant | Price | Effect |
|---|---|---|---|
| 1 | Retracting cyberclaws | 2k¤ | Mollies or Logans, d6 damage |
| 2 | Mule pocket | 500¤ | Big enough for a SmartGun™ |
| 3 | Subdermal shockers | 2k¤ | d4 damage to anyone grabbing or hitting you in melee. +2DR to avoid electrical damage |
| 4 | Autocamo | 3k¤ | Subdermal projection of ever-changing anti-facial-recognition patterns |
| 5 | Additional joints | 2k¤ | -2DR to all grapple-related tests, able to fit into small spaces |
| 6 | Buzzeyes | 3k¤ | Fly-like eyes with 360-vision capabilities |
| 7 | Strangler | 300¤ | Filament wire hidden in a finger, d6 damage each round when grappling |
| 8 | Skinhard | 3k¤ | Hardened skin providing -d2 armor |
| 9 | Deserter fangs | 500¤ | DR10 bite attack, d6 damage. 2-in-6 risk of a free attack against you |
| 10 | SmartJack | 4k¤ | Enhanced cerebral/RCD-links enabling you to use Smart™-tech (e.g. SmartGuns™) to its full potential |
| 11 | Muscle-ups | 5k¤ | +1 on tests of raw strength such as crushing, lifting, pulling. +4 carrying capacity |
| 12 | PulseWires | 6k¤ | +1 Agility, Presence, Strength, or Toughness for 2 hours. Each Pulse costs 75¤ |
| 13 | BodyGun | 7.5k¤ | Hidden, single shot, large-caliber gun, 2d10 damage |
| 14 | Taurs | 1.5k¤ | Horns, d4 damage |
| 15 | Sonic blaster | 6k¤ | Deafening sonic wave hitting up to d3 targets for d6 damage. Recharges automatically after 6 hours |
| 16 | Handy bot | 4k¤ | Detachable drone hand with a 50m range |
| 17 | Smarthair | 1.2k¤ | Change hairstyle at will |
| 18 | Skinslot | 1.5k¤ | Extra App slot for your deck, hidden beneath your skin |
| 19 | Skeleplating | 15k¤ | Skeleton covered in a thin metal layer, +10 HP |
| 20 | Brainbox | 500k¤ | Black box for your brain. As long as it remains intact at the point of death, the user''s mind can be restarted in another brainbox. Cloning or otherwise getting a new body comes with additional costs and is highly illegal unless you already are rich beyond the reach of the law |

Some equipment (see `catalog_gear`) is also available as a cybertech
implant/mod for ×10 to ×50 the listed gear price.

## Apps (p.70/74-75)

Custom-made cartridges and cassettes with the ability to hack tech and
physically affect your surroundings when slotted into a cyberdeck. To use
an App you need to be jacked into your deck and have the App loaded into
one of its slots. While jacked in, you perform all non-App actions with
+2DR. Test Knowledge DR12 to successfully activate an App. A fumble burns
the App for the day and triggers a Backlash (see App Fumbles below). Each
App use adds +1 to the risk of fumbling when using Apps until the next day.

| Roll (d12) | App | Effect |
|---|---|---|
| 1 | WEIAN-Hammer | Nearby devices are triggered to perform their function, i.e. open/close unlocked doors, trigger sprinklers, start a camera recording, adjust the AC. You can trigger 5 devices as you choose over the next 5 rounds |
| 2 | RCDOvrChargr | One target gets +d6 on all Agility and Strength tests for Knowledge+3 rounds |
| 3 | Nok_Nok | Open a nearby locked door. Failure may trigger an alarm |
| 4 | False Flagger | Fake an alarm or the location of a triggered alarm. Any response to a real alarm is delayed by 2d6 minutes |
| 5 | SigilTag | This location and nearby systems are tagged with your invisible sigil, enabling you to remotely activate Apps as if you were present. Only two locations can be tagged at the same time |
| 6 | >eRase | Cut or copy the latest 10 minutes of stored information from any type of recording/surveillance device |
| 7 | De-fenc/der | Take control of a nearby turret, drone or similar defense system for d6 rounds |
| 8 | Blood Snoot | Tracks down an enemy hacker and deals d4 damage each round until they pass a DR12 Knowledge test or die |
| 9 | PathMapper | Uses nearby sensors, cameras and public information to create a detailed 3D map of the surrounding ~100m |
| 10 | CTechAttak | d3 nearby cybered targets lose a total of 4d10 HP |
| 11 | beaconworm | Place a tracker into a device or cybertech, enabling you to track its movements in real-time for the coming d4 weeks |
| 12 | TrolleySkipper | Automated defenses have trouble tracking a person of your choice and prioritize other available targets |

### Non-App hacking

Gathering information through non-App hacking requires a cyberdeck and is
a time-consuming downtime activity. Test Knowledge to break into data
nodes. Failing the test means the hacker is discovered, and the data
owners and their SecOps team will respond somehow. A fumble triggers a
Backlash.

### Getting more Apps (d10, p.71/75)

New Apps are hard to find, and hackers willing to sell often ask for
something like this in return:

| Roll | Price |
|---|---|
| 1-4 | A large favor — use the mission generator with the App as a reward |
| 5-6 | Another App as a trade |
| 7-8 | 2d4×1k¤ |
| 9-10 | Get rid of the hacker''s creditor |

## App Fumbles / Backlashes (d20, p.72/76-77)

Triggered by a fumbled App activation (or a fumbled non-App hacking
attempt, GM''s choice of an appropriate entry).

1. Black ice left behind by an unidentified entity hits you for 2d10 damage and burns your deck. It requires a workshop and a Knowledge DR14 test to fix.
2. An unknown hacker begins tracing and interfering with you; +3 risk of App fumble and +2DR on all App activities or use of other connected technology for d6 days.
3. The App you were trying to activate explodes, destroying both the App and a slot in your deck.
4. A SecCorp activates a Ghost targeting you. It arrives in d4 minutes.
5. A minor EMP triggers, and all tech within 15m malfunctions for d4 rounds.
6. You''re flagged for suspicious activity. All further tests to use Apps or get through a security check are +2DR until you either get rid of it yourself by spending d6×10 minutes and pass a DR14 Knowledge test, or by waiting 48 hours without using any App or other suspicious Net activity.
7. A power surge causes all lights within 30m to flicker and then explode. Everyone nearby takes d4 damage.
8. You run into a booby trap, triggering an alarm and shorting out your deck. You take d6 damage and need to reboot and rejack to be able to use any tech again.
9. A mistake causes a loopback, and you successfully use the App but with the wrong target or a reverse effect. The exact details are up to the GM.
10. You are ID''d by a hacker collective. They ask for d10k¤ in 72h or they will post real or fabricated incriminating data of you and your friends for everyone to see.
11. A feedback buzz hits you for d6 damage, blinding you for d4 rounds as one of your eyeballs boils in its socket.
12. Feedback hits you for d3 damage. Unknown to you, dangerous data is also copied to your deck, and several people or organizations are willing to kill to get hold of that data. They will know who you are when you next use an App.
13. Your RCD is corrupted. Real and unreal items glitch in and out of existence. Any test relying on sight is +4DR for d4 hours or until you can get 10 minutes of uninterrupted concentration.
14. A virus gets inside your deck and destroys 2 empty slots in it. If no slots are empty, a random App is destroyed instead.
15. Your deck and RCD both freeze, and you are unable to act for one round. Millions of spam messages have been sent out in your name. You are blocked from all communication channels until you replace your deck and pay a d6k¤ fine.
16. d4 sleeper Doppels are activated with you as their target. They will strike in hours, days, or maybe even weeks from now.
17. Nearby devices shoot bolts of electricity, dealing d12 damage to anyone in the room who fails a Toughness DR14 test. This goes on for d6 minutes.
18. Everything your RCD has picked up in the last 2.3 seconds is broadcasted to all monitors, screens, RCDs, etc. within 500m.
19. Black ice hits you for 2d6 damage, sending you into convulsions for d6 rounds. Test Presence DR14 or lower your Presence by −1.
20. You stumble upon an extrinsic presence, perhaps an AI or something worse. Roll d6: 1-2 it speaks to you in a language you cannot understand or record; you are unable to act for d4 rounds. 3-4 it shrieks, and your deck explodes, dealing d6 damage to you and d3 nearby targets. 5-6 it possesses you and your deck. All tech/App-related rolls are -2DR for d6 rounds. From this moment, you and it are one.

## Nano powers (d12, p.74/79)

Strange powers — rumored to be an infection of alien bacteria riding
nanorobots — that first appeared in the Incident''s aftermath. Test
Presence DR12 to use a power: success activates it, failure hurts you for
d2 damage, and a fumble also triggers the linked infestation (see below).
Each Nano use adds +1 to the risk of fumbling when using Nano powers
until the next day.

1. **Benevolent suturedroids** — d2 people regain d10 HP each. A roll of 6 or greater comes with a free migraine.
2. **Pineal gland stimulation** — For d4 rounds, you can feel nearby data flows. You can hear a short conversation or message, sense the direction of a large data source or see the last few seconds of the most recently recorded information on a device.
3. **Cosmic dust bots** — An area of up to 20m in diameter is covered in dust and darkness for the duration of a fight or for 10 rounds. It tastes like stained, rusted metal.
4. **Psychic scalpels** — A living target of your choice tests Presence DR14 or loses d10 HP. Their eyes bleed, and their ears ring.
5. **Bent prism** — A person becomes invisible and attacks and defends at DR6. The effect lasts for d6 rounds or until you are hurt.
6. **Crawling carapace** — d4 targets gain −d6 armor for 4 rounds.
7. **Chill of the void** — Up to d4 targets test Toughness DR14 or take d4 damage. Next round, DR16 and d8 damage. Rounds three and four, DR16 and 2d10 damage. Frost covers the area, and snowflakes float in the air.
8. **To dust** — Half a cubic meter of inorganic matter turns to dust. If the target is attached to or in the hands of a conscious creature, the test to activate the power is DR14.
9. **Dead cell spirits** — By consuming a handful of something dead, you can relive their last moments as if through a hazy and distorted lens. Test Presence DR14 to avoid taking d6 damage from ego death.
10. **Lifetap** — Choose two targets, one to heal and one to hurt. The healing target tests Presence DR10 to heal d6 damage, while the second target is dealt d6 damage. Failure deals both targets d3 damage.
11. **Remote control** — A target within spitting range must obey a single command. You will forever hear their wordless voice faintly echo in your mind.
12. **Swarm trip** — Your mind is transferred to a flying swarm of bacteria for 10 minutes. You can move through any crack or hole, and see whatever the swarm sees but not hear or interact with anything. If your body is killed or you''re not back at your body when the 10 minutes are up, you are stuck in the swarm forever.

## Infestations (d20, p.76-77/80-81)

Infestations linked to a Nano power trigger on a fumbled Nano use.
Infestations *not* linked to a Nano power trigger whenever you''re dealt
5+ damage by a single attack and fail a Presence DR10 test. The **bold**
text is a permanent, passive effect; the description after it is what
happens when the infestation is triggered.

1. **Alien crabs.** Bugs crawl beneath your skin. *They burrow deeper, sending you to the ground, shaking with pain for d6 rounds.*
2. **Rot.** Skin and flesh slowly rot. *Large chunks of skin fall off. You take d6 damage and for the rest of the day, take an extra +2 damage from physical sources.*
3. **Flora.** Your skin is tinted green or purple. Plant matter grows over your wounds. *Flowers bloom from your mouth and scream violently for 10 minutes, after which they wither and die. During this time you cannot speak and add +2DR to all your actions.*
4. **Third eye.** It does not look human, that eye in the middle of your forehead. *Your sight shifts to the alien eye, revealing endless spectra of colors incomprehensible to the human mind. For d6 rounds, you have −4DR on all Presence and Knowledge tests but +4DR on everything else.*
5. **Gills.** You can breathe under water. *For d6 rounds, you cannot breathe air — test Toughness DR12 each round or suffer d4 damage.*
6. **Tubes.** Thick, rubber-like hair that moves against the wind. *It starts to twist and turn around your face and arms, constraining you and d3 other nearby targets. +4DR to any attack or defense tests until either they break free by testing Strength DR12 or someone helps them struggle loose.*
7. **Brittle bones.** Your Strength counts as one less for calculating carrying capacity. *A sudden vibration. The sound of shattering glass. Extreme pain. You take 1 point of damage for each item you are carrying.*
8. **Bloodthirst.** You have to eat raw meat every 2-3 hours to survive. *You can''t control it anymore. It. Must. FEED. For d3 rounds, you can do nothing but attempt to bite or claw your way into the nearest person''s main artery.*
9. **Barbed skeleton.** Sharp pieces of bone pierce the skin around your joints. You need to grind them down every two weeks, or they hinder your movements. *A growth spurt occurs, causing d4 damage, bleeding wounds and for the next hour, +2DR on all actions that require moving your limbs.*
10. **Radiance.** A faint, eerie glow surrounds you. Geiger counters malfunction in your presence. *You flash brightly and deal d6 damage to yourself and up to d6 others in your close proximity.*
11. **Fading.** You seem to fade in and out of existence. *You disappear from sight and all sensors, but you are stuck in complete darkness for d4 rounds, after which you appear in a random location up to 50m from where you were.*
12. **Seed pods.** Pea-sized seed pockets cover most of your body. *Seeds shoot out of your body, weakening you for the next hour as the seeds rapidly grow back. All physical tests are +4DR for this hour.*
13. **Crystalline.** Small buds of crystal cover your body. *They expand, immobilizing you as the crystal covers your entire body. You are unable to move for d3 rounds, and any damage taken during this time is tripled.*
14. **Nanite echo.** Your eyes are yellow and red. *A semi-physical copy of yourself appears behind you and attempts to kill you or a nearby ally, whoever is weakest. The echo has d12 HP and deals d6 damage with its ghastly grasp.*
15. **Elongated fingers.** Twice the length they used to be. *They painfully twist and bend. You are unable to use weapons or other items requiring a firm grip for the next d10×10 minutes.*
16. **Cold.** Humidity turns to frost on your cold skin. *Your body temperature drops, and the air around you seems to freeze. You and everyone close to you act with +2DR for the next minute.*
17. **Rage.** Skin pulled tight, your blood is boiling. *You lose control of your senses and attack anyone near you for d4 rounds. Whatever controls you prefers to use offensive Nano powers first and your fists second.*
18. **Bloated and moist.** *You swell up even more, and a greyish liquid seeps from your orifices. +4DR on every test for 10 minutes.*
19. **Bestial, enlarged maw.** *It splits in two and grows even larger when triggered. You take d8 damage but can bite for d6 damage for the next hour.*
20. **Magnetic.** You attract metal objects. Usually only noticeable at a few centimeters'' distance from your skin. *Small metal objects come flying towards you. Defend against metal melee weapons or bullets at +4DR for the next d6 rounds.*
', '70', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();

insert into system_packs (system, section, title, body, sort_order, use_in_play, use_in_rules)
values ('cyborg', 'generators', 'CY_BORG Generators', '# CY_BORG Generators (missions, corps, cults, headlines)

Transcribed from p.28-39 and p.118-133 (Appendices). Complements
`encounter_reference`''s condensed job-generation framework with the full,
book-accurate sub-tables and the book''s real corp/faction names (rather
than the placeholder names the condensed version uses).

## Mission generator (p.118-127)

Roll, pick and choose, mix and match, ignore what does not make sense.
Fill in the blanks. Reuse known people, locations and organizations.
Corps and cops are always the bad guys.

### Patron — acting on behalf of... (d20)

| Roll | Patron |
|---|---|
| 1 | A politician |
| 2 | A megacorp |
| 3 | An ambitious startup |
| 4 | A money launderer |
| 5 | An arms dealer |
| 6 | A strange cult |
| 7 | A secret society |
| 8 | A street gang |
| 9 | The CEO of a major corp |
| 10-11 | Themselves |
| 12 | Their lover |
| 13 | Someone a PC owes money |
| 14 | A nearby neighborhood community |
| 15 | A clan of roadrunners |
| 16 | A current VIP |
| 17 | Another group of punks |
| 18 | A renowned hacker |
| 19 | A former enemy |
| 20 | An AI or other Net entity |

### Contact — the PCs are contacted by a... (d20)

| Roll | Contact |
|---|---|
| 1 | Friend from the old days |
| 2 | Family member |
| 3 | Untraceable Net user |
| 4 | Casual acquaintance |
| 5 | Previous patron |
| 6 | Known fence and fixer |
| 7 | Gang-goon |
| 8 | Lover/ex-lover |
| 9 | Regular from the PCs'' favorite watering hole |
| 10 | Street kid |
| 11 | Masked stranger |
| 12 | Bodega owner |
| 13 | Former enemy |
| 14 | Mobster |
| 15 | Ports smuggler |
| 16 | Washed-up VIP |
| 17 | Concerned citizen |
| 18 | Cultist |
| 19 | Job broker |
| 20 | Someone a PC owes money |

### Reward — who promises... (d20)

| Roll | Reward |
|---|---|
| 1 | Nothing. They do it or else... |
| 2 | Nothing. "Please help, you are the only ones who can!" |
| 3 | A future favor |
| 4 | Info they may have use for |
| 5 | Useable gear |
| 6 | A vehicle |
| 7 | Illegal goods they can use or sell |
| 8 | A place to crash and hide out |
| 9 | An in with high-paying clientele |
| 10 | Fame and exposure |
| 11 | Getting rid of half of a single PC''s debt |
| 12 | A piece of experimental cybertech |
| 13 | d6k¤ |
| 14 | d10k¤ |
| 15 | 3d10k¤ |
| 16 | 5d10k¤ |
| 17 | 3d10k¤ |
| 18 | d10k¤ |
| 19 | 2d10k¤ |
| 20 | 2d10×10k¤ |

### Job verb — if they... (d20)

| Roll | Verb |
|---|---|
| 1 | Sabotage |
| 2 | Escort |
| 3 | Steal |
| 4 | Deliver |
| 5 | Threaten |
| 6 | Kidnap |
| 7 | Blackmail |
| 8 | Observe |
| 9 | Protect |
| 10 | Save |
| 11 | Distract |
| 12 | Find |
| 13 | Smuggle |
| 14 | Destroy |
| 15 | Punish |
| 16 | Trick |
| 17 | Fight for |
| 18 | Win over |
| 19 | Plant |
| 20 | Infiltrate |

### Target (d20)

Each entry offers an object option and a person option — pick whichever
fits the rolled verb.

| Roll | Target |
|---|---|
| 1 | A shipment of illegal goods / a gang-goon |
| 2 | Some blackmail material / a politician |
| 3 | A piece of fine art / a recently released criminal |
| 4 | A prototype weapon / a friend |
| 5 | A unique vehicle / a sibling |
| 6 | A server / a hacker |
| 7 | An offline database / a secret source |
| 8 | An experimental cure / a doctor, medical or otherwise |
| 9 | A secret hideout / a group of punks |
| 10 | Evidence of some crime / a cop |
| 11 | A highly important video recording / a current VIP-celeb |
| 12 | A bunch of explosives / a military officer |
| 13 | A piece of prototype technology / an inventor |
| 14 | Records of personal communications / a lover |
| 15 | A relic / a cult leader |
| 16 | A piece of jewelry / a neo-aristocrat |
| 17 | An important power source / an AI or other Net entity |
| 18 | Someone''s mind palace / an immortal |
| 19 | A signed contract / a lawyer |
| 20 | A data dump / the journalist who made that big scoop last year |

### Location — the target can be found in a... (d20)

Each entry offers two alternative locations — pick whichever fits.

| Roll | Location |
|---|---|
| 1 | Corp office or on an active crime scene investigation |
| 2 | Dive bar or known drug-trafficking den |
| 3 | Night club or a freight ship in port, with a labyrinth of hidden compartments |
| 4 | Luxury residence or a shelter hidden behind a nondescript door inside a subway station |
| 5 | Apartment building or a forgotten doomsday bunker |
| 6 | Medical facility or the set for the next holoflick in the Blood Countess franchise |
| 7 | Hideout or some sewer tunnels with Nano-infested algae |
| 8 | Warehouse or a meeting place for the disgustingly rich |
| 9 | Moving vehicle or an RV with several dead bodies hidden behind a fake wall |
| 10 | Underground parking garage or a fully automated protein cloning and packaging factory |
| 11 | Shopping mall or the ritual chamber of a strange serpent drug cult |
| 12 | Street corner or a network of utility tunnels booby-trapped by the street kids who live here |
| 13 | Street food stall or an underwater human cloning facility |
| 14 | Restaurant or an ancient subway tunnel accessible through a G0 crater |
| 15 | Factory or deep inside a lost virtual world |
| 16 | Drug den or in one of the top levels of the Narwhal arcology |
| 17 | Entertainment complex or a shelter for the severely Nano-infested |
| 18 | Maintenance hub or an archipelago spa retreat for the upper class |
| 19 | Laboratory or within LifArt, the largest living artwork/gallery/artist collective in Cy |
| 20 | Construction site or beneath a replica pyramid |

### Geo — somewhere in... (d20)

| Roll | District |
|---|---|
| 1 | Central: the Arcs |
| 2 | Central: North |
| 3 | Central: South |
| 4 | Central: Undersjön |
| 5 | Slums: Bigmosse |
| 6 | Slums: Lilypond |
| 7 | Slums: Barnyard Fields |
| 8 | Slums: Laketon |
| 9 | Hills: Edges |
| 10 | Hills: Galgbacken |
| 11 | Hills: Oak Isles |
| 12 | Inbetweens: Burnchurch Hex |
| 13 | Inbetweens: Svärta |
| 14 | Inbetweens: Low Meadow |
| 15 | Industrial: Mosscroft |
| 16 | G0 |
| 17 | Ports |
| 18 | Sewers and underground |
| 19 | On/in water |
| 20 | Outside of Cy |

### Security — it''s protected by... (d20)

*Reconstructed as one d20 table: the source prints this as two visually
separate blocks of 8 and 12 entries (p.126/130) that read as a single
continuous 1-20 numbered list once the printed numbering is followed —
content is reliable, only the visual split is a source-layout artifact.*

| Roll | Security |
|---|---|
| 1 | United Citadel Security |
| 2 | Slum roughnecks |
| 3 | Well-trained SecOp team |
| 4 | Mainly drones and turrets |
| 5 | Enhanced beasts |
| 6 | Roadrunner clan |
| 7 | Street gang |
| 8 | Virid Vipers |
| 9 | Off-duty cops |
| 10 | SecOps and NanoGoons |
| 11 | Cyberslashers |
| 12 | A group of punks |
| 13 | Corp assassin strike team |
| 14 | Wild Nanophreaks |
| 15 | AI with weapon platforms |
| 16 | Way more guards than first apparent |
| 17 | A death cult |
| 18 | Drunken, low-rate SecOps |
| 19 | Stealth-suit psychopath |
| 20 | Vindicator Cydroid and handler |

### Complication — but something complicates the job... (d20)

| Roll | Complication |
|---|---|
| 1 | The contact or target starts acting against their own interest |
| 2 | Rival punks interfere or are on the same contract |
| 3 | Someone a PC owes money to shows up and interferes |
| 4 | Nothing |
| 5 | It''s just a distraction for the patron to pull off something bigger |
| 6 | It''s a trap |
| 7 | Another team of punks or SecOps will try to hunt them down as soon as the job''s done |
| 8 | Someone else gets there first |
| 9 | The contact backpedals on the reward |
| 10 | The contact got the situation all wrong |
| 11 | The job has a very short deadline |
| 12 | The contact or target is not who they claim to be |
| 13 | The contact or target disappears |
| 14 | There are a lot of bystanders in the way |
| 15 | The contact or target is arrested |
| 16 | The events are being recorded |
| 17 | Everything turns to chaos |
| 18 | A miserable headline occurs midway, changing the situation |
| 19 | The target is a friend or loved one |
| 20 | The group gets a counteroffer from someone else |

### Location features (3×d10, p.127)

Roll on any or all three as needed when detailing a mission location.

**Distinctive feature (d10)**

1. Under renovation; paint buckets, scaffolding, etc. spread around.
2. Holoprojections of historical art pieces in most rooms.
3. Anti-Nano propaganda everywhere.
4. Every room is a separate floor. Two elevators service every second floor only.
5. Parts have been taken over by squatters engaged in a slow but deadly conflict with the owners.
6. Vertigo-inducing animated wallpapers.
7. Traces of a recent gunfight with bullet holes and soot from small fires still on the walls.
8. Way cleaner and more luxurious than expected.
9. Surprisingly rough and dirty.
10. Due to a hostage situation, SecOps have surrounded the building next door.

**Hidden feature (d10)**

1. Maze-like crawlspaces hidden in walls, floors, ceiling.
2. Hidden cameras in many rooms, planted there by someone else.
3. A secret room used as a reaperdoc clinic.
4. Paper-thin internal walls.
5. A small data node that leads into the low-res virtual hellscape of a dying world. A terrible monster guards a large ¤ stash.
6. Sentient maintenance system can be bribed to work with the party.
7. Hidden conspiracy board detailing plot behind the latest miserable headline.
8. In a gamma-ray protected vault sits an artifact of terrible and weird powers.
9. What look like mannequins are knock-off skulkers with sharp claws.
10. A cassette with a custom App. Has a tracker that will ping the App author as soon as it''s used.

**Additional danger (d10)**

1. Large valuable art piece covered in Nano-spreading dust.
2. A glitching Ghost is stuck in a loop somewhere, attacking anyone who enters its vicinity.
3. Locked maintenance door leads to a temple of a small but violent cult.
4. Tech use has a 50% chance of triggering an electrical fire.
5. Three vials of Red Pain marked as Red-juice left on a table.
6. An out-of-place laser turret fires at everyone without the password.
7. A Cy-raging menace locked inside a padded room.
8. A canister with a non-human creature that warps reality around it if disturbed.
9. Mold in the walls releases sight-blocking spores when bullets hit them.
10. An EMP booby trap renders all electronics unusable for 10 minutes if triggered.

## Corp generator (Appendix 5.1, p.128)

Roll a d12 on each of Name Part One, Main Industry, and Name Part Two to
build a corp name (e.g. "Cy" + "Tech" = CyTech, in "Security"); optionally
roll d20 for a recent scandal.

**Name Part One (d12)**: 1 Cy · 2 Kifo · 3 Fosse · 4 Útga · 5 Crown''s · 6 Galg · 7 Smrt · 8 Gene · 9 Pereo · 10 Progen · 11 Häx · 12 Futura

**Main industry (d12)**: 1 Propaganda/news · 2 Lifestyle · 3 Property · 4 Finance · 5 Biomedical · 6 Food Products · 7 Raw material · 8 Entertainment · 9 Weapons · 10 Legal/lobbying · 11 Security · 12 Transport

**Name Part Two (d12)**: 1 Futures · 2 Tech · 3 Inc · 4 Industrial · 5 Labs · 6 Nero · 7 Mgmt · 8 Svärta · 9 Wave · 10 Institute · 11 Division · 12 Malum

**Latest controversy (d20)**

1. Massive collateral damage in corp war.
2. Selling undisclosed cloned human meat.
3. Supplying violent gangs with personal data for profit.
4. Non-informed human test subjects.
5. Mandatory Osleep for every employee working 48+ hour shifts.
6. Rumors of several board members being part of a cannibal cult.
7. Offering homeless people 10¤ to equip them with subdermal projectors for displaying advertisements.
8. Kidnapping a competitor''s key staff.
9. Hazardous waste dumping.
10. Cybertech enhancements made mandatory for certain employees.
11. Selling dead employees'' body parts after workplace accidents.
12. Employee contracts include the rights to firstborn children.
13. Rules against dating non-employees.
14. Assassinating several product reviewers and critics.
15. Dropping a weaponized meme on a public square, resulting in 138 deaths.
16. Non-consensual cloning.
17. Increasing employee loyalty through secret memory alterations.
18. Kidnapping customers, releasing them into a booby-trapped murder maze and recording it for a pay feed.
19. Using customer data for blackmail.
20. A weaponized virus released during corp war spread outside their intended target.

## Cult generator (p.129)

Roll d12 on each table and combine, e.g. "The Nuclear Destruction cult,
worshipping in a private virtual world with outdated security."

**Worshipping (d12)**

1. Nuclear destruction
2. A free AI
3. Nano
4. Death
5. A number-station prophecy
6. The cult leader
7. A pantheon of dead celebrities
8. Progress
9. The unborn child of light
10. She of the Dark
11. The Two-Headed
12. Those who came before

**Temple (d12)**

1. A private virtual world with outdated security
2. 2nd top floor of north Central ''scraper
3. G0 ruin''s basement
4. Unused salons in a Galgbacken holocinema
5. An unmarked door inside Burnchurch Hex subway station
6. Sub-level 43B of the Nutopia Arc
7. A closed-down factory in Mosscroft
8. Public but heavily defended temple in Edges
9. A private residence in Oak Isles
10. Atop a high-class Ports restaurant
11. An abandoned and partially flooded Laketon block
12. A Lilypond community center

## Corp index (Appendix 01, p.161-164)

The 13 named corps/factions with named leadership, for dropping into
missions built with the generators above. The source lays each entry out
in a 4-box-per-page grid, and text extraction scrambled which name-label
belongs to which box on two of the four pages — every entry below was
cross-checked against the name-bearing mentions elsewhere in the book
(Miserable Headlines bylines, the City of Yg chapter''s district writeups)
before being assigned, so the attributions are reliable even though a
couple of names weren''t printed directly beside their own bullet list in
the extracted text.

**Alliansen Inc.** — Real estate, security, entertainment, behavioral analytics, voting, research; also sports, financial services, staffing, AI, communication, cybertech. Controls most of the Borghold prison complex. Mrs. Lia, President of the Board; Jaci F. Ah, Head of Security Operations. At war with UCS. Leasing infrastructure to half of Cy''s SecOps.

**AST** — Fish/algae products, restaurants, lobbying, water shares; also education, childcare, submarine construction, cloning. Gigantic processing plant and aquaculture farms in south Mosscroft. Lakshmi Viswan, product manager for submarine housing; unnamed project lead for Undersjön. Rising competition with Cynergy Water & Power Co.

**Fideistic Transformation** — Religion, cerebral interfaces, egotech, medtech, drugs; also education, feeds, staffing, hotels. Megatemple in the Neon Pillar, North Central. Hiero-Confessor Selva Ergene; Protomartyr Warad-Ishtar. Members make up an inappropriate number of Cy-rage victims.

**Gravf/Mellberg/Tosk** — Law, risk management, security, credit, real estate; also marketing, financial services, nightclubs and restaurants, luxury wares. HQ in the Golden Spire, South Central. Three members from each founding family make up the board, with younger members in all top-layer executive positions. (The "mobster law firm" of South Central per the City of Yg chapter.)

**Cynergy Water & Power Co** — Facilities, infrastructure, transportation, real estate, sports; also food, entertainment, communication. HQ in The Floating Hive, North Central. Dana Azar, COO; Zane #13, star forward of the CyBorgs. Megacorp posing as public infrastructure — a parasite among predators.

**Heirs of Kergoz** — Nano worship, death. Large parts of Barnyard Fields pay tribute to the Heirs. The horde of the corrupted, masked and nameless. At war with the Virid Vipers. Harbingers of the end; saviours of the Nano-infested.

**Royal West Shipping** — Logistics, storage, retail, infrastructure, travel; also vehicles, sports. HQ and warehouses in the Ports (the largest and most well-guarded there), large presence in all three actual ports. Sri Alraune, CEO; NordShip, the first shackled "true" AI, currently runs all logistics operations.

**Kaytell Makers** — Materials, production, construction, bio/cybertech; also retail, entertainment, fashion. Several large factories on Mosscroft, large farms outside of Cy. Mr. Kaytell, Founder and CEO. Rumors say Mr. Kaytell has been running the corp for 150 years and that the true HQ has been moved into orbit.

**Spectral FT Banks & Holdings** — Financial services, real estate, infrastructure; also entertainment, retail. HQ in the Neon Pillar, North Central. Dr. Thaba Samson, CFO; Ms. L.H. Ergene, archangel investor. Gathering resources and lobbyists focused on medtech.

**Virid Vipers** — Drugs, security, combat enhancers; also courier services, entertainment. Presence all over south Cy, minor branches in nearly every other district. Led by the Council of the 10 Fangs. At war with the Heirs of Kergoz.

**United Citadel Security (UCS)** — Security, weapontech, combat enhancers; also cerebral interfaces, AI, spacetech. HQ in Citadel Tower, South Central. Mr. O.B.P. Gunner, CEO; the Gail couple, lead designers of the automated weapon platforms dept. At war with Alliansen Inc. Outfitting most of Cy''s SecOps.

**Tulles&deVerte** — Feeds, lifestyle products, drugs, famous for being famous; also fashion, entertainment, restaurants, weapontech, staffing. Penthouse in South Central, clubs in Ports. Tomi "Toad" Dian, lawyer/fixer from Gravf/Mellberg/Tosk. Angel investors for all the latest social platforms.

**TG Labs** — R&D in bio/Nano/med/gene/space/other tech; also sports, health services. Orbital research stations; Ports showroom/experience center. Dr. Daevy, lead researcher. Rumored to have several G0 blacksites.

*One additional, unattributed entry appears in the source grid (p.161)
whose name label was lost to extraction — industries AI, weapontech,
bio/medtech, insurance and health services, vehicles, security, food
production, Nano research; decentralized offices around Central and the
Industries; namechecks A. Gustafsson as a board member, "The Hermit" as
the first-ever "true" AI, and an AI called Chariot that controls most of
Cy''s automated vehicles. Likely a fuller writeup of one of the corps
above (Alliansen Inc. is the leading candidate, given A. Gustafsson''s
MedTech board-membership elsewhere in the book) rather than a 14th
distinct corp — flagged here rather than guessed at.*

## Miserable headlines (p.28-39)

**The mechanic**: the GM rolls a die each midnight. A result of 1
activates a Miserable Headline. A d66 then determines which terrible
event makes the rounds on the news that night — adjust locations and
people involved so it affects the PCs. The same headline won''t appear
twice; reroll the d66 if it comes up again. The 7th time a Miserable
Headline is rolled, it is always **#0x0** (below).

The group decides how often these events occur by picking the die size:
d100 = quarterly, d20 = monthly, d12 = biweekly, d6 = weekly, d4 =
constantly. d6 days after the event, it''s already been turned into a
virtuaflick, hologame, and a trend or meme people are bored of.

*Rows 1-3 below have their exact d66 sub-numbering (11-16, 21-26, 31-36)
confirmed directly from the source''s printed tags. Rows 4-6 (41-46,
51-56, 61-66) had their numeral tags visually scrambled by text
extraction — the headline text itself is reliable and complete, but
exact tag-to-headline pairing within those three rows is presented in
the source''s reading order rather than confirmed; treat 41-46/51-56/61-66
as approximate slot numbers if precise d66 bookkeeping matters.*

**Row 1 (11-16)**

11. **The UCS-Alliansen War Escalates** — Bombs, firefights and swarms of silent kill-drones turn half the city into an ever-expanding warzone. Millions die.
12. **Arc Dagan in Flames!** — Toxic smoke from the burning arcology shrouds Cy in a fluorescent, deadly mist, forcing people indoors and underground. Vision is low, radioactivity high.
13. **The 616 under Siege** — Police and SecCorps lay siege to the 616th Legion, worshippers of a nameless disc-like deity. The cult activates sleeper agents who begin killing citizens at random, causing mass panic.
14. **Anti-Human Bioterror Attack** — The body count climbs after the bio-bombings of several passenger cars earlier tonight. All metro, monorail and tram carts are closed while major SecCorps compete to hunt down the SickSickSickWorld terrorist cell that claims credit for the act.
15. **The Ports District Stalker Unmasked** — An exclusive sit-down interview with ''Cy in the Morning'' to discuss their methods. The serial killer is someone the PCs know or have worked for.
16. **The VIP Reaper a VIP?** — Details on the manhunt for a suspect in the theft of luxury c-tech and serial druggings in exclusive clubs. A VIP known to the PCs is shown drugging the reaper''s latest victim.

**Row 2 (21-26)**

21. **Cy-Rage Hotspot!** — An ultra-chromed soldier''s Cy-rage triggers all nearby tech, causing a pandemic of high-voltage bloodlust. "Worst case, it leaks into the Net," experts say.
22. **Sri Alraune Kidnapped by Murderous Cultists** — The White Sign''s Chosen announces "a very public and very viral" execution of their high-stakes hostage: the CEO of Royal West Shipping. The market trembles — the cult has done this before.
23. **G Wall Breach Releases Nanophreaks into Ports** — Due to an explosion of unknown origin, a section of the G0 border wall has collapsed. Mutated Nanophreaks have already been sighted rampaging in the Ports.
24. **Blackout in Lilypond as Blood Flows in the Streets** — The LP vigilante militia barricades the streets as gangs attack in the pitch-black night. Cynergy Water & Power Co blames a software error but has no timetable for recovery.
25. **Ammo Prices Skyrocket!** — An ammo drought hits Cy after a devastating explosion at the ACGS munitions factory tears a hole in the city skyline. Mags are at a premium, and melee weapons have become a thrifty alternative.
26. **Adam R3 Taken Hostage by Black Luna!** — Widespread panic as hacker-terrorist Black Luna threatens to overload the fusion reactor hub''s AI. Their demands are not yet known.

**Row 3 (31-36)**

31. **Mystery Messages Set Off Cult''s Danse Macabre** — A pirate signal broadcasts ''Xhive moves to the beat of worship'' across every RCD. Blood-drenched maelstroms of blades and bullets — claimed by a local doomsday cult, the Dancers — spread across the city.
32. **Secession at PrimaLux Arcology** — MilCorps are synchronizing as Cy''s largest arcology declares independence. All attempts to breach the "free haven for the oppressed" have been met with barrages of obliterating lasers, EMPs and chem-bombings.
33. **Undersjön Machine Operators on Strike, Plan Public Party Instead** — Tens of thousands of curious guests are expected tonight when the construction site opens for the first night of partying. The structural integrity of the unfinished underwater paradise is uncertain.
34. **Police Budget Increase, Vow Return to Normalcy** — Cy Security Council institutes a zero-tolerance block policy to curb criminal elements. Police are encouraged to shoot on sight any suspicious parties. This policy is instituted in the PCs'' neighborhood of operation.
35. **Tap Water Advisory!** — Water services have begun shutting off water all over Cy and cautioning those who still have access. No explanation has yet been given, save that consumption is "incredibly dangerous".
36. **VIP Duo AlexIsi Goes Out with a Bang** — Though mostly famous for allowing paying fans to jockey their drug-fueled nights of excess in the Ports, the VIP duo has ended their tour with a DIY bombing in a North Central flat. Their entire fortune is to be split between their dealer, plastic surgeon and a contact of the PCs who has allegedly never even heard of the couple.

**Row 4 (41-46, approximate sub-numbering — see note above)**

41. **Warzone: Screaming Stone Harbour** — Bombings and capsized cargo ships set off a mob war between (alleged) drug traffickers/coffee shop entrepreneurs Red Lions and (alleged) cyberorgan harvesters Habathanum. It is unclear which group ignited the conflict.
42. **Swarm Brings Droning Hellscape to Cy** — A blight of buzzing locusts has obliterated the factory farms to the south and have now reached the city, obscuring the sun to those on mid-level or lower. The cost of food will skyrocket for the next two weeks. The famished riot.
43. **The Pharma Cartel Price Gouging** — "There is no cartel. This is Net conspiracist slander against our R&D teams," says A. Gustafsson, board member of a dozen MedTech companies in the city. All medical services are now ten times the normal price.
44. **HackAttack or Bad Maintenance? ("404 404 404 404")** — The Net glitches; nothing is working. No one claims responsibility. Rogue AI, or ecoterrorism?
45. **Ecoterrorism?** — An arcology-sized (alien?) plant organism has appeared overnight in Barnyard Fields. Scientists have yet to determine its origin or threat potential, as comms have been glitching and casualties from its arrival are mutated beyond field lab analysis.
46. **Thunderstorm and G0 Dust Clouds Shut Down the Three Ports** — All traffic in and out of Cy is postponed until the weather clears. Non-essential travel through the sandblasted city streets is not advised.

**Row 5 (51-56, approximate sub-numbering — see note above)**

51. **CYBORGS WIN!** — Celebratory fan riots shut down multiple city blocks with no sign of stopping. This goes on for weeks.
52. **Tsunami Hits Mosscroft, Sea Level Rises!** — Coastal sectors are ravaged by titanic waves. Mosscroft factories spill their chemical swill into the water, turning it into a toxic cocktail. Sewers and service tunnels across Cy flood. The stench never goes away.
53. **Air Quality Advisory** — Due to pollution leakage, the Mosscroft surface zone is declared a no-go zone. Filter masks are required for prolonged outdoor activity in neighboring areas.
54. **Economy in Shambles: Catastrophic Error or Devious Cyberattack?** — As of this morning, money lacks value, credsticks malfunction and all global financial data is corrupted. In short, all ¤ is useless. With luck(?), systems and backups are up again in d6 weeks.
55. **Disconnect After Reading!** — A novel interface worm spreads on all public RCD networks. It attacks the memory center of both the biological brain and the digital storage of any linked device. Several infected are sent into murderous rage shortly after infection. All public networks are to be shut down.
56. **Borghold Prison Break!** — Megaward 9 ejects 5,000 inmates who scatter into hiding among the Arcs of South Central. Seven of them are infamous, highly cybered killfreaks with a 10k¤ bounty each. Cops, SecOps, and merciless mercenaries now swarm the area, killing without discretion, competing for those bounties.

**Row 6 (61-66, approximate sub-numbering — see note above)**

61. **Wintercove Square NUKED!** — The mushroom cloud rises over Cy as South Central — with all its arcs and corp HQs and hitherto immortal fat cats — ceases to be. Collateral and casualties send the market into a freefall on Cy''s darkest day since the Incident. Thus far, no organization has claimed credit for the attack.
62. **Solar Storm Goliath Causes Comm Blackout** — All wireless communications more advanced than antique radio are down until the storm passes.
63. **Orbital Drop Invasion!** — Parliament, a well-armed and disciplined orbital gang, has invaded Cy from the space elevator, seizing control over several districts. Local gangs and SecCorps are at a loss as the situation grows more dire, and tactics turn more desperate.
64. **Massive Heatwave Hits Cy** — Rolling brownouts and violence are expected for the next two weeks as the temperature continues to climb. AC is to be rationed outside the commerce districts to reduce strain on the grid.
65. **Technological Rapture?** — As the Fideistic Transformation megatemple goes silent and its known members alongside thousands of others have vanished, the public must wonder: have their goals of whole-brain emulation finally been achieved? 50% of the PCs'' contacts, associates and enemies are now gone.
66. **Implosion at InstaLeap Portal Lab** — Purple skies over Cy due to an illegal, experimental facility incident in Old Cy that has torn open a rift to...somewhere. MilCorps are mobilizing with heightened budgets, and security around the Wall is increased.

### #0x0 — Are We Living in a Simulation?

Rector Magnificus Professor Dr. Duru Evren at CyU has found proof that
the world is a simulation run by unknown entities. Evren could not be
reached for further comment. In 12 hours, the simulation resets. Replay
the entire campaign.
', '80', 'f', 't')
on conflict (system, section) do update set
  title = excluded.title,
  body = excluded.body,
  sort_order = excluded.sort_order,
  use_in_play = excluded.use_in_play,
  use_in_rules = excluded.use_in_rules,
  updated_at = now();