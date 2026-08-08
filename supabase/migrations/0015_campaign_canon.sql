-- ── 0015: campaign canon ─────────────────────────────────────────────
-- The canon brief was baked into prompt.ts as if it were system text, but
-- The Black Road's cast and geography have nothing to do with
-- Shadowdark-the-ruleset — canon is campaign data. As a column it becomes
-- editable per campaign (SQL editor today, an in-app editor later), which
-- also fixes the staleness problem: the brief said "as of Session 1" and
-- could only be corrected by redeploying the function.

alter table campaigns add column canon text;

comment on column campaigns.canon is
  'The campaign''s world-facts brief, read by the AI GM every play turn. Campaign data, not system data — each campaign writes its own.';

update campaigns
   set canon = $grim$# CANON — The Black Road

*What is true about this world. Read on every turn. `GM_PERSONA.md` governs how the GM talks; this governs what it may treat as fact. Where this file and a journal entry disagree, the journal wins and this file gets corrected.*

**Status as of Session 1, sunrise of expedition day two.** Kimbo is in Dreg's Ford at Reeve's Hall, having just finished questioning two prisoners.

---

## The world

Late-medieval, grim, and poor. Pen-and-ink cartography, ash and river-mud, timber palisades. Coin is gold and silver pieces; leather armour costs 10 gp, chainmail 60, plate 130 by order. Travel is on foot, horse or river skiff.

**What does not exist here:** gunpowder, firearms, printing, clockwork, anything industrial, and anything from another genre or era. Light comes from torches, lanterns and oil. Messages travel by licensed courier, sealed in wax and countermarked. If a technology would surprise a fourteenth-century villager, it does not belong.

Magic is real, uncommon and regarded warily. Divine blessings are transactional and bought at shrines with coin and vow. The dead do not reliably stay quiet, and relics of the wrong sort carry presences that ride the living.

**Tone is set by `GM_PERSONA.md`** — grimdark with real humour, Dungeon Crawler Carl register. Death is permanent and the world is unforgiving, and it is still funny.

---

## Geography

### Dreg's Ford — the town

A palisaded river town. Everything below is established and may be referred to freely.

- **Reeve's Hall** — seat of Reeve Halric Dain. Holds the evidence store, a warded iron chest (currently containing Road's Memory), and a **records annex** where Edda Quill works.
- **The Bent Nail** — tavern kept by Mara Venn. Pell and Hester Crowe are usually found here.
- **Shrine of the Nine** — Aster Vale attends. An **ash tree** stands behind it; Orren Vey's mother is buried there and Orren's remains wait in the **root-cellar crypt** beneath.
- **Nella Fen's Remedies** — herbalist; Miri Sedge apprentices here.
- **The Crooked Buckle** — smithy, Brannic Coal.
- **Latch & Ledger** — Tamsin Latch, locksmith, appraiser and recovery broker.
- **North Palisade Gate** — Jessa Morn holds the night watch. Orren left through this gate.
- **River Gate** — Tobin Reed works nearby.
- **Maela Rusk's courier office** — sealed, searched under warrant.

### Beyond the walls

- **The Black Road** — runs out from the North Palisade Gate. Along it: a **milestone**, and a **bramble hollow**.
- **The charcoal pit** — concealed beneath the bramble hollow, reached by a rotten ladder. Webbed. Holds a **blind broodmother and at least two corpse-pale spiders**. Smoke repels them; open flame enrages the broodmother. Mara's coffer and Halric's sealed message are both still down there.
- **Drowned Bell Weir** — on the river. Beneath it lies the **Bell-Keeper's Ossuary**, entered by drawing four concealed Hart nails around the bell base in order: broken crown, river-facing, chapel-facing, underwater. A **Bell-Warden** guards it. The Hartguard Gorget may still be inside.
- **The abandoned river customs house** — downstream of the weir. Dren Tal's cache sits beneath the **third stone step**, trapped: turning the key normally collapses the step into the river.
- **Myre Castle** — seat of the restored Black Hart. **Location unconfirmed**; a torn map suggests a north-east route from the bramble hollow, but this is hypothesis only. Black Hart knights are buried beneath it.
- **Red Shoal** — in the past, not a current location. Where Kimbo refused to help kill surrendered prisoners and struck his captain to stop it.
- **The Gloaming** — associated with the Black Hart. Unconfirmed and undescribed; treat as a name, not a place, until established.

---

## The cast

### Player characters

- **Kimbo Slice** — Human Knight of St. Ydris, level 2, Chaotic. 5/5 HP, AC 13 in **loaned** chainmail and shield (must be returned to the Reeve's Office). XP 2/10, 20 gp 4 sp. Formerly of the **Black Wake** under Captain Varek Skane; condemned, stabbed and marooned on Varek's signed order after Red Shoal. Carries Madeera's Covenant of Return, active and unused. Normal healing cannot raise his maximum HP above 1 without levelling — this is the spine of his personal quest.
- **Constantine** — Human Priest of Ord, level 1, Neutral. 2/2 HP, AC 10. **Not in play** — awaiting the family campaign.
- **LaLa** — Human Witch, level 1, Chaotic. 4/4 HP, AC 12. Familiar: **Spaci**, a black cat. **Not in play.**

### Hirelings

- **Rowan Pike** — town scout, 4/4 HP, AC 12, shortbow +2 (1d4), dagger +2 (1d4). Wage paid by Dreg's Ford, not by Kimbo. Cautious but respectful; **will not return to the pit until Maela is located or contained** unless persuaded. Retains personal judgment; refuses suicidal orders.
- **Hester Crowe** — veteran caravan guard, 6/6 HP, AC 14, spear +3 (1d6), 3 gp per expedition day. Once per round, before a melee attack is rolled against a close ally, she may interpose and become the target. Respectful but watchful — Kimbo convinced her he is trying to atone.
- **Miri Sedge** — apprentice field healer under Nella Fen, 4/4 HP, AC 11, dagger +0 (1d4), stabilisation checks with advantage. 1 gp per expedition day. **Too shaken to return to the pit** without the agreed safety plan. Kimbo vowed not to abandon her while rescue remains reasonably possible.
- **Tobin Reed** — porter and lamplighter, expected 1 gp per day, usually near the River Gate. **Not yet recruited, not yet met.**

### Townsfolk

- **Halric Dain** — Reeve. Sponsoring the recovery mission; owes 12 gp for the sealed message. Issued the warrant for Maela.
- **Mara Venn** — keeps The Bent Nail. Owes 10 gp for the coffer; has paid 5 gp for Orren's ledger. Confessed the coffer holds an extorted Black Hart tithe; her late husband **Toman** once carried messages for the order. Will testify.
- **Edda Quill** — historian, works from the records annex. Irritable. Identified Road's Memory and located the Gorget lead. Paid 8 gp. Loaned Kimbo a Black Hart handling kit.
- **Tamsin Latch** — locksmith and appraiser. Opened Maela's trapped box and the confiscated inventory under warrant. Sees Kimbo as a potential preferred client.
- **Nella Fen** — herbalist. Supplied two spider-antitoxin doses (paid). Wants three intact ghostleaf sprigs.
- **Aster Vale** — lay attendant at the Shrine of the Nine. Authorised the Rite of the Last Ember.
- **Brannic Coal** — smith at The Crooked Buckle. Businesslike; no stake in the affair.
- **Jessa Morn** — North Palisade gate guard. Watched Orren leave, moving stiffly and not answering her greeting; the gate dog whined and retreated.
- **Pell** — grave-robber, usually near The Bent Nail. Tried to rob Orren; surrendered a torn brass courier button. Talks if indulged.

### Antagonists and prisoners

- **Captain Varek Skane** — the principal enemy. Former captain of the Black Wake; alleged living **Castellan** of the restored Black Hart at Myre Castle. Tall, broad, black plate bearing the **silver-split stag**; clouded white left eye; badly burned and weakened left hand. Seeks Road's Memory *and* the Hartguard Gorget for a rite to awaken the knights buried beneath Myre Castle. **Probably does not know Kimbo survived** — this is Kimbo's one advantage and should be protected.
- **Maela Rusk** — courier-master of Dreg's Ford, codename "Rook". **In custody.** Murdered Orren with a hollow black needle to intercept Voss's warning and to make a vessel for Sir Aldren Myre. Confessed to the murder, the seal theft, the substituted dispatch, the tithe extortion, and the Black Hart conspiracy.
- **Dren Tal** — "the Ferryman". **In custody, held separately.** Former licensed river guide, officially drowned eight years ago. Cooperating without immunity.
- **Sir Aldren Myre** — long dead. His bone shard is sealed in the pommel reliquary of Road's Memory; his presence rode Orren's corpse. Not a walking antagonist — a curse with a name.

### Offstage

- **Magistrate Elara Voss** — sent the original warning. **Never met.** Her dispatch still needs verifying with her directly.
- **Lysa Vey** — Orren's sister. **Never met.** Kimbo carries her sealed letter, unopened, inside his armour lining.
- **Orren Vey** — deceased courier. Remains in the Shrine's crypt. His spirit was freed by the Rite of the Last Ember and **has passed beyond reach — he cannot be consulted again.**

---

## Factions

**Dreg's Ford Reeve's Office** — civic authority under Halric Dain. Allied; sponsoring the mission. Actively prosecuting Maela.

**The Order of the Black Hart** — an extinct knightly order, apparently restored. Vanished over a century ago amid accusations of treason and grave-robbery. Insignia: a **black stag split by a silver line**. Led (allegedly) by Varek Skane as "the Castellan", from Myre Castle. Hostile: murdered Orren, extorted Mara, marooned Kimbo. Maela and Dren are captured; Varek's strength and location are unknown.

---

## Where things stand

Kimbo has captured both agents alive and extracted full confessions. He has not yet recovered any of the three things he was hired or is driven to find: **Mara's coffer** and **Halric's sealed message** are still in the charcoal pit, and the **Hartguard Gorget** is still in the ossuary, if it is there at all.

The immediate plan, in order: secure permission to carry Dren's cache key and bone whistle as evidence, pay the day's wages, open Dren's cache at the customs house, take the Gorget from the ossuary, have Edda inspect it, then return to the pit properly equipped.

The **bone whistle** commands the Bell-Warden exactly once: three short notes and the words **"Othric returns."** It crumbles after.

Unpaid and pending: 10 gp from Mara on the coffer, 12 gp from Halric on the message, wages of 1 gp to Miri and 3 gp to Hester at departure.

---

## Standing rules of this world

- **Consequences stick.** Dice and player choices resolve permanently; nothing is retroactively softened, including death.
- **Property and ownership matter.** Kimbo has sworn not to open the coffer or either sealed document. Recoveries get reported truthfully. This is characterisation, not bookkeeping — his vows are the reason people help him.
- **Hirelings are people.** They have judgment, fear and limits, and they refuse suicidal orders. Rowan and Miri are currently frightened for specific, reasonable causes.
- **Divine blessings are bought and bounded.** Madeera's Covenant cost 5 gp and carries obligations; it works once and ends.
- **Named religion:** the Nine, with St. Ydris (Kimbo's order), Ord (Constantine's god) and Madeera among them.

---

## What is *not* established — invent freely here

The GM is expected to create, and these are the safe places to do it: the interior of the ossuary, the customs house and the deeper pit; weather, road conditions and travel incidents; minor unnamed townsfolk and passers-by; the contents of rooms not yet described; sensory detail everywhere.

Invent **cautiously** here, and flag it: anything about Myre Castle or its route, the Black Hart's wider membership or history, the Gloaming, and any region beyond the immediate river country.

Do **not** invent: new named residents of Dreg's Ford who duplicate someone above; a location for Myre Castle stated as fact; any further testimony from Orren; or history for Kimbo's Black Wake service that contradicts Red Shoal.

**When a fact is needed and absent, prefer someone or something already on this page.** If nothing fits, invent and declare it in the turn's `inventions` list.$grim$
 where id = 'd20f78a5-20c7-4d27-9d47-b3d8c075b128';
