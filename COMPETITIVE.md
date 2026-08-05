# Grimoire vs. Foundry VTT — Competitive Analysis

*Written Aug 4 2026, before Journal v1 kickoff. Foundry state: v13 era, $50 one-time GM license, players free via browser, self-hosted or rented cloud, 10,000+ community modules, and an actively maintained community Shadowdark system (Muttley/foundryvtt-shadowdark) with extras modules and a Shadowdark UI theme.*

## What Foundry does well (respect it, learn from it, don't fight it)

1. **The digital battle map is a solved problem — by them.** Dynamic lighting, vision, fog of war, walls, scene building: best in class, a decade of work, 10k modules deep. Nothing in Grimoire's plan should compete with this. If a table wants tactical map simulation, Foundry deserves to win that table.
2. **The business model is player-friendly**: GM pays once, players join free in a browser. Lesson adopted: joining a Grimoire campaign must never cost a player money or an install — a link and a sign-in, nothing more.
3. **Their architecture validates ours.** Foundry is a system-agnostic core with game systems as installable packages — exactly the shape of Grimoire's multi-system seams (system field, rules module, content packs). Independent confirmation the design is right.
4. **Community extensibility compounds.** Modules made Foundry unkillable. Grimoire's equivalent someday is content packs, not a module API — but the principle (the community finishes the product) is noted for the far future.
5. **The open-source Shadowdark system for Foundry is a useful reference** for content modeling decisions (how they structured items, talents, spells) — reference for *shapes* only; their code and any licensed compendium content stay out of Grimoire per the reference-only and licensing rules.

## Foundry's structural weaknesses (Grimoire's openings — all deliberate, none accidental)

1. **Setup is a tax on the GM.** Self-hosting needs networking knowledge; scene prep is hours per session; reviewers describe the ideal user as a "technical GM." Grimoire's answer: a URL. Sign in on a phone, play. The Reeve's Office doesn't require port forwarding.
2. **The world sleeps when the GM's server does.** Foundry campaigns live on the GM's machine; between sessions, the campaign is effectively offline — and between-session memory (journals, recaps, what-happened-last-time) is its weakest surface. Grimoire is campaign-first: the journal, quests, and character state are always on, in every player's pocket. **This is exactly why Journal v1 is the first slice.**
3. **No real mobile story.** No official mobile app; the UI assumes a desktop. Grimoire is phone-first by spec — the at-the-table and on-the-couch device is the primary target.
4. **No AI GM, no solo mode.** Foundry simulates a table that still requires a human GM's full prep and presence. Grimoire's AI GM is a first-class seat with the same validated commands as a human — solo play is Milestone 1, not a module. This is the single largest differentiator and the reason the user's own play (solo via Claude chat) has no Foundry equivalent.
5. **Grid simulation is the wrong model for Shadowdark.** Foundry's core metaphor is tokens on measured grids; Shadowdark's real system is three abstract range bands, dynamic person-carried light, and real-time torch pressure. Grimoire models the game as written (zones, ambient timers) instead of importing a wargame table — attempt 1 learned this the hard way with its hex grid, and it's now a locked design decision.
6. **Prep-heavy vs. play-light.** Foundry rewards GMs who love preparation. Shadowdark is a rules-light, prep-light game; its tables want less machinery, not more. Grimoire's bar for every feature: does it reduce what the table must manage mid-scene?

## Positioning, in one line each

- **Foundry replaces the battle map. Grimoire replaces the GM binder — and, when asked, the GM.**
- Foundry is where a session happens; Grimoire is where a campaign *lives*.
- They can coexist at the same table: nothing stops a group from using Foundry for a dungeon crawl while Grimoire holds the campaign's memory, characters, and AI GM. Grimoire never needs to beat Foundry head-on to win its niche: solo/AI-run tables, distributed casual groups, and rules-light play.

## Does this change what we build first? No — it confirms it.

Journal v1 attacks Foundry's weakest front (between-session campaign memory) while building toward the differentiators Foundry structurally cannot follow: AI GM as a peer, phone-first, zero setup. The things Foundry does best — lighting simulation, measured grids, module platform, integrated A/V — are all already out of scope in SPEC.md, now with a competitive reason attached to the design reason. Two additions from this analysis: (a) the player-cost rule above becomes explicit (joining is always free and installation-less); (b) the Foundry Shadowdark system is logged as a shapes-only content-modeling reference for the content-pack slice.

## Addendum: the AI-GM field (surveyed Aug 4 2026)

A category of AI game masters now exists — Fables.gg (most complete: multiplayer up to 6, 5e-inspired, world tools), AI Realm, StoryRoll, AIDungeonMaster.ai, RoleForge (alpha), AI Dungeon (freeform), plus raw ChatGPT/Claude play. Shared traits: web-based, D&D-5e-inspired or generic rules, chat-first. Shared weaknesses, per the field's own reviews: loose "5e-inspired" rules rather than a real published system enforced faithfully; weak persistence and manual state tracking (the raw-LLM approach's known failure — exactly the pain Grimoire's owner lives with today); AI-only, with no human-GM mode.

Grimoire's unoccupied ground, against this field: (1) **a real published system, run as written** — nobody serves Shadowdark, and nobody enforces any system with an authoritative command/event-ledger architecture where nothing is narrated that wasn't actually rolled; (2) **human and AI GMs are interchangeable seats** on the same validated commands, with mid-session takeover — competitors are AI-only, Foundry is human-only, Grimoire alone spans both; (3) **campaign memory is the spine, not a sidecar** — the journal/ledger is the product, where the field treats persistence as a weak afterthought; (4) **bring-your-own licensed content** in private storage rather than a proprietary in-app world. Closest watchlist competitor: Fables.gg. Verdict: the category's existence validates demand; its shared weaknesses read like Grimoire's spec, written by someone else.
