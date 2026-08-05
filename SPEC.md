# Grimoire — Specification

> Grimoire is attempt two at the same destination as Delve (attempt one, archived at `~/Developer/_Archive/yetidark` and `Yetiouz/yetidark`): a multiplayer web app for running Shadowdark RPG campaigns with a human or AI game master. This spec is seeded from a full read of the attempt-1 archive and finalized through the Aug 4 2026 spec interview. **Status: interview complete — ready to build.** Claude: implement only what's specced here; anything unclear gets asked, not invented.

## What Grimoire is

A companion app for Shadowdark RPG serving three seats at the table: the player (character sheet, dice, live table view), the GM (dashboard, encounter tools, secrets, prep), and the AI GM (same validated command interface as a human GM, never a separate rules path). Players and GM share a live game table: scene log, party chat, dice, maps with zone-based positioning, turn order, clocks, and light tracking — all realtime.

## What attempt one actually achieved (the honest baseline)

Delve was further along than "failed prototype." As of its archive date it was a **working, deployed multiplayer app** that passed a structured two-account production playtest (July 29, 2026):

Working in production: GitHub OAuth sign-in (magic-link fallback), campaigns with discovery/join codes/roles, guided character & campaign builders, full character sheets (gear, talents, spells, XP, coin, AC), live game table + GM dashboard (scene log, party chat, dice, hex map with GM-controlled fog, turn order, votes, encounter/monster HP tracking, GM notes), campaign management (settings, house rules, threads, clocks, timeline, light tracking, rules library, NPC/faction/treasure trackers), a first AI-GM edge function, URL routing with session restore, and a player-table status rail.

Under the hood: 36 numbered migrations, an append-only campaign event ledger, authoritative server-side commands for every audited mutation (HP/XP/coin, rests, gear, spells, clocks, light, dice, atomic character creation), authorization hardening with a 152-test database suite, GM secrets separated from player-readable data, private signed-URL map storage, and a one-command verification gate (`pnpm verify`: audit + lint + rules tests + routing tests + build) enforced by GitHub Actions.

**The archive is a reference library, not a starting point.** Key documents to consult, in the archived repo: `docs/ROADMAP.md` (the definitive milestone plan), `docs/PROJECT_STATUS.md`, `docs/BUILD_LOG.md`, `CLAUDE_CONTEXT.md` (technical gotchas), `docs/MULTIPLAYER_PLAYTEST.md` (the acceptance-test template), `supabase/migrations/` (the schema, evolved honestly), and `gm-brain/` (GM persona, house rules, session protocol — the AI GM's source material).

## Design decisions already made (locked in during attempt 1 — carry forward unless deliberately reversed)

These came out of mockup reviews and rules research in late July 2026 and represent real design work; re-deciding them from scratch would be waste:

- **Zones, not hex grids.** Shadowdark's range system is three unmeasured bands — Close (melee), Near (~30ft), Far (sight). In-scene play uses an illustrated scene image with Close/Near/Far zone rings and tokens placed in zones, not cells. Dungeon layout/orientation is a separate concern. (The hex-grid fog map was attempt 1's biggest modeling mistake.)
- **Light is dynamic and person-centered** — the radius follows whoever carries the active source; no ancestry has darkvision, so "who's lit" is moving, gameplay-critical state.
- **Exploration has its own counter** (crawling rounds / wandering-monster checks tied to time and noise), separate from combat rounds.
- **Secrets have three states**: hidden → tell-visible (noticeable by specific classes at normal pace) → revealed. Not a binary flag.
- **Monster visibility is two independent toggles**: presence-known and HP-visible.
- **Each PC gets one assigned color** used everywhere: token ring, presence avatar, chat name, party HP list.
- **GM notes are contextual**, attached to the selected map entity or inline in the log — not a flat notes panel.
- **Scene log and Party chat are two always-visible panels, never tabs** (tabs bury messages).
- **Player view gets a top stat strip** (HP/AC/Gear/Luck/Torch) and presence avatars on both views.
- **Rules corrections already researched** (apply before building advancement/spells): no talent roll at level 2 (1/3/5/7/9 only), level-up HP is flat class die with no CON, XP threshold is current-level×10 then resets, Sea Wolf talent is +2 STR/CON or +1 attacks (no DEX); spell lockout follows the house rule (pre-success failures don't lock; natural 1 always mishaps).

## Technical lessons banked (from CLAUDE_CONTEXT.md and the build log — expensive to relearn)

- **RLS + RETURNING gotcha**: `.insert().select()` fails RLS when the SELECT policy depends on a row that doesn't exist yet (e.g. creating a campaign before campaign_members). Fix: client-side `crypto.randomUUID()`, insert without `.select()`, create dependent rows separately.
- **Debug RLS as the real user**: rolled-back transaction with `set local role authenticated` + JWT claims in the SQL editor — far better than guessing from errors.
- **Realtime only fires for tables in the `supabase_realtime` publication** — first thing to check when live updates silently fail.
- **Echo own actions locally immediately** instead of waiting for the realtime round-trip (that lag read as "dice don't work") — but guard against duplicate render when the realtime insert arrives.
- **Authoritative commands + append-only event ledger** for every meaningful mutation (actor, reason, before/after). This architecture worked; it's what made the playtest trustworthy. AI GM uses the same commands.
- **Every schema change is a numbered migration; rebuild + run the authorization test suite before applying.** Attempt 1 had to painfully reverse-engineer its live schema into migrations after the fact — never let schema and migrations drift again.
- **GitHub OAuth primary, magic links fallback** (Supabase's built-in email sender has a project-wide quota that will lock you out at the worst time).
- **One verification command** (`verify`: audit + lint + rules tests + routing tests + build) wired into CI from day one.
- **Process that worked**: backend changes → build directly + PR; visual changes → mockup first, confirm, then build; milestone acceptance = replaying the Bjorn/Allindra test campaign scene end-to-end with two accounts (playtest checklist is in the archive).

## What went wrong (confirmed in the spec interview, Aug 4 2026)

In the user's own words: the core mistake was **building a bunch of pages first and then trying to make them all work together after the fact**. Confirmed contributing factors: the UI never felt right (functional but plain, and retrofitting the visual direction felt worse than starting clean); the code got unwieldy (60KB components made every change feel risky); wrong foundations were baked in early (hex map, screen-first habits from the mock-data prototype). The restart was chosen because a clear path *from the beginning* beats inheriting drift, even from a working app.

**The governing principle for attempt two: no screen gets built until the system underneath it exists.** Every slice is vertical — database → command → UI — working together by construction, never wired together afterward.

**Top priority (user's choice): stay in control** — at any moment the user understands what exists, what's next, and why. One spec, one roadmap, no competing plans, no mystery state.

## Architecture (carried forward deliberately)

Same shape as attempt 1 — it was audited twice and confirmed right; a proposed microservices split was explicitly rejected:

- React 18 + Vite + Tailwind, single frontend on Vercel (repo `Yetiouz/grimoire`, push-to-main deploys)
- Supabase: Postgres + Auth + Storage + Realtime + Edge Functions
- pnpm, ESLint, node test runner; `verify` command + GitHub Actions from the first commit
- **TypeScript** (decided Aug 4): the compiler is an automatic per-change check, and Supabase generates types from the schema so app and database can't silently drift
- **Design system first** (decided Aug 4): before any screen, build Grimoire's UI kit — colors/fonts seeded from the landing page, panels, buttons, chips, log entries — as a living style-guide page. Screens are assembled from approved pieces; nothing ships plain
- **Archive reuse rule: reference only** (decided Aug 4): read attempt 1 for lessons and data-model shapes; every line of Grimoire is written fresh. No pasted code
- **Component size rule**: no component file grows past ~300 lines without being split; screens compose from the UI kit and feature components
- **Shared components rule** (added Aug 4, user's call): domain pieces like a PlayerCard (name, HP, luck, torch-lit state, PC color) are built once and reused on every page that shows a player — GM view and player view render the SAME component and differ only in the data the page passes in. Components display what they're given; pages decide visibility. This makes "the GM's player-view preview exactly matches what players see" true by construction.

### Visual quality rules (adopted Aug 4 from design research; the style guide page is their living reference)

- **Typography is a closed set**: display (Pirata One, brand moments only — never UI headings), h1/h2/h3 (Bebas Neue, uppercase, condensed), body/body-secondary (Instrument Sans, ink/ink-dim), caption (Chivo Mono, small secondary text — Badge, Button labels, LogEntryRow sender/timestamp; no baked-in color, the caller sets one), label (Chivo Mono, eyebrow style, ink-faint), numeric (Chivo Mono, tabular-nums for compact stat-strip values), dataDisplay (Chivo Mono, tabular-nums, larger standalone readouts — torch time, dice math, coordinates-style values). No ad-hoc font sizes or weights on any screen.
- **Mobile minimums**: player-facing body text never below 16px on phones (also prevents iOS input auto-zoom); touch targets at least 44px; every screen designed phone-first as a single column that unwraps wider.
- **Reading measure**: running text (especially the scene log) caps its line length (~35ch phone, ~65ch max desktop) instead of stretching full width.
- **Alignment**: functional text is left-aligned; centered text is reserved for brand moments.
- **Every screen ships four states**: loading, empty, error, populated — all four appear in the style guide as components exist for them. Empty states may carry flavor text ("No entries yet — the pages await").
- **One motion rule**: 150ms ease transitions, 1px hover lifts, subtle glows — the landing page's vocabulary, applied everywhere, nothing improvised.
- **Spacing is a closed scale**: 4/8/12/16/24/32/48/64px only — no arbitrary values. Six semantic slots govern use: micro 4 (tight pairs), related 8–12 (grouped items), component 16 (panel padding), separated 24 (distinct blocks), section 48 (major regions), page 64 desktop / 24px gutter phone. Documented as a Spacing section on the style-guide page.
- **Iconography is closed too**: lucide-react, always through the `Icon` component (`app/src/components/ui/Icon.tsx`) — never a raw lucide import. Fixed 24px grid, fixed stroke weight, both hardcoded rather than exposed as props. Color comes from exactly one of three states (default/active/danger — ink-dim/purple/red), defined once, not per call site. `name` is itself a closed set: the initial working icons the journal and nav need (HP/AC/Gear/Luck/Torch for the stat strip, plus journal/chat/dice/party/settings/close/disclosure), not lucide's full library. Documented as an Iconography section on the style-guide page, right after Spacing.
- **Demo data is part of the design system**: screens are built and reviewed against the Bjorn/Allindra demo fixtures, never lorem ipsum.
- The app targets phone and laptop from the start (Milestone 1's acceptance explicitly includes "on my phone")

## Milestone plan (reshaped in the Aug 4 interview — solo + AI GM first)

The first real user is the app's owner playing solo with the AI GM; friends across the USA join later to test, using external voice/video. This inverts attempt 1's "AI last" ordering — but keeps its hard-won rule: **the AI GM uses the same validated commands as a human GM, never a separate rules path**, so the command/event architecture is still built first.

**Milestone 1 — Solo campaign with the AI GM.** Acceptance, in one sentence: *"I open grimoire on my phone or laptop, sign in, create a Shadowdark character, and play one short scene solo with the AI GM — it narrates, I roll real dice in the app, my HP/inventory update, and when I come back the next day the campaign remembers everything."* Forces: auth, characters (builder + sheet), campaigns, scene log, authoritative commands + event ledger, server dice, AI GM edge function, session persistence. Zero multiplayer complexity.

*Candidate first slice (today-value): the campaign journal.* The user is actively playing a solo Shadowdark campaign via Claude chat right now and wants play logged as it happens. A campaign + log + event ledger slice is independently useful before the AI GM even lives in the app — session events can be recorded into Grimoire alongside chat-based play, and every later system writes into the same log.

**Milestone 2 — Friends join.** Realtime multiplayer on the working solo loop: invites, roles, presence, live sync (echo-locally pattern), player table vs GM/AI view boundaries. Acceptance: the two-account playtest checklist from the archive, run with a friend remotely.

**Milestone 3 — The full encounter engine.** Clockwise initiative (d20+DEX, surprise re-roll), Close/Near/Far zones, one action + Near move, attacks/damage, dying (1d4+CON timer, nat-20 recovery), stabilizing (DC 15 INT at Close), morale (DC 15 WIS). Acceptance: the bull-statue scene end to end.

**Milestone 4 — Spellcasting & advancement.** Spellbook against the spell-cycle state; real level-ups with the rules corrections above.

**Milestone 5 — Campaign continuity & GM prep.** End-session review, journal views, snapshots over the event ledger; adventure workspace, map management, handouts.

**Milestone 6 — Hardening & launch.** Accessibility, rate limits, backup drills, monitoring.

## Out of scope

No voice or video chat — games run over Discord/FaceTime/etc.; Grimoire is the table, not the call. No microservices. No reproducing licensed Shadowdark rulebook text in the public repo (purchased PDFs belong in the private `rule_documents` storage bucket feature). No virtual-tabletop measured-grid movement. No other rule systems for now.

## Verification standard

Every slice ends with evidence: `pnpm verify` green, plus for gameplay slices the two-account playtest pattern from `docs/MULTIPLAYER_PLAYTEST.md` (role boundaries, realtime sync, refresh persistence, event-ledger audit).

## Decisions log

- 2026-08-04 — Restarted from scratch as Grimoire; attempt one archived at `~/Developer/_Archive/yetidark`.
- 2026-08-04 — Landing page shipped as placeholder `index.html`; repo `Yetiouz/grimoire` linked to Vercel (live at grimoire-sable.vercel.app); GitHub Desktop is the push path.
- 2026-08-04 — SPEC seeded from full attempt-1 archive read: feature inventory, locked design decisions, technical lessons, and inherited milestone plan recorded above.
- 2026-08-04 — Spec interview completed. Root cause named: pages built first, wired together after. Priority: stay in control. First use: solo + AI GM; friends join in M2 (external voice/video). Decisions: TypeScript; design system first; archive is reference-only; ~300-line component cap; phone + laptop from the start. Milestones reordered accordingly; campaign journal flagged as the today-value first slice.
- 2026-08-04 — Typography pass against rig.ai for inspiration (palette and Pirata One brand face kept unchanged): Inter replaced by Instrument Sans for body/UI text; Chivo Mono added as a third face for label/numeric/button text; heading contrast increased (h1/h2/h3 sized up; `display` gets a responsive size pair so the brand mark stays safe on phones); body line-height widened to 1.7.
- 2026-08-04 — Bebas Neue promoted from a one-off style-guide headline fix to the full h1/h2/h3 heading system: condensed, uppercase, single weight, positive tracking (grows as size shrinks). Replaces Instrument Sans for headlines; Instrument Sans narrows to body/UI text only. A fourth theme font (`--font-heading`), alongside `--font-sans`/`--font-mono`/`--font-brand`.
- 2026-08-04 — Palette identity ratified after a Figma exploration pass: Grimoire stays torchlight-purple dark fantasy; the neon-grid direction was considered and declined. Adopted from the exploration instead (in Grimoire colors): caption + dataDisplay typography levels, mono status chips, input/modal/table/metric-tile patterns.
- 2026-08-04 — Design-system finalization batch, built against the palette/spacing decisions above: typography closed set grown to ten levels — added `caption` (small secondary text, purged from Badge/Button/LogEntryRow/TypographySection's prior ad-hoc `text-xs`/`text-sm` styles) and `dataDisplay` (larger Chivo Mono readouts, promoted from `numeric` on TorchTimer/DiceResult). Spacing scale audited across the existing kit and normalized (Badge's dot, LogEntryRow's sender-dot offset, StatTile/TorchTimer's label-to-value gap, and the style guide page's own vertical rhythm were all off-scale — fixed); a Spacing section was added to the style guide, right after Typography. Touch targets verified: Button now guarantees the 44px minimum via `min-h-11` independent of text metrics (caption is smaller than the old ad-hoc button text); TextInput and Modal built to the same minimum. Three new components: StatusChip (Badge's mono key:value cousin, e.g. "TORCH: 38M"), TextInput (default/focus/error, 16px text), Modal (confirm pattern — title, body, ghost-cancel + primary action) — all shown in every state on the style guide. Table pattern and metric-tile-with-progress explicitly deferred to the trackers slice, not built here.
- 2026-08-04 — Bug fix: Instrument Sans/Chivo Mono/Bebas Neue were silently not loading on the deployed site (falling back to system fonts) even though the source looked right and dev looked right. Root cause, confirmed by fetching the built production CSS: Vite/Tailwind v4's CSS build (Lightning CSS) drops a remote `@import url(...)` from the bundled output entirely — the built stylesheet had zero `@import` rules, and `document.fonts` only ever contained the self-hosted Pirata One face. Fixed by moving font loading to `<link rel="preconnect">`/`<link rel="stylesheet">` tags in `app/index.html`, which the CSS bundler can't touch — not just a workaround, standard practice for exactly this reason. The self-hosted Pirata One face (`@font-face` with a local `url()`) was never affected; only the three remote Google-hosted families were silently dropped.
- 2026-08-04 — Icon system decision: adopt lucide-react, governed the same way as typography/spacing — strict, closed, not ad-hoc. Fixed 24px grid and stroke weight (hardcoded in the `Icon` component, not exposed as props); color from exactly one of three states (default/active/danger) defined once; `name` itself a closed set — the initial working icons the journal and nav need, not lucide's full library. Documented as an Iconography section on the style guide, right after Spacing.
- 2026-08-05 — Style-guide page shell rebuilt to match `styleguide-mockup.html` (repo root, the approved target composition): masthead with mono doc-metadata and a Bebas title, numbered section eyebrows (`001 // FOUNDATION`), a sticky side index with real anchors/smooth scroll/scroll-spy (hidden under 800px), hairline dividers, every component state in a labeled specimen cell (mono tag + state indicator). Pure composition — no token or component API changed. All 15 sections that existed before this rebuild migrated in, in the mockup's category order; Badge/StatusChip and TextInput/Modal merged into single "Badges & Chips"/"Inputs & Modals" sections per the mockup's grouping.
- 2026-08-05 — Design-system audit-fix list closed out (three remaining items): (1) `EmptyState`, `Skeleton`/`SkeletonGroup`, and `ErrorBanner` built — the last of SPEC's required four screen states (loading/empty/error/populated) now exist as real components, shown in every state in the App States style-guide section. `Skeleton` is a bare pulsing bar (like `Panel`, deliberately unopinionated — callers compose real loading shapes from one or more), with `SkeletonGroup` providing one `role="status"` announcement per group rather than per bar. `ErrorBanner` mirrors `DangerBanner`'s shape but is always red (one severity, not two) and takes an optional `onRetry`. (2) `Panel`'s `interactive` prop used to be hover styling only, with no way to actually activate it — added an optional `onClick`; only when both `interactive` and `onClick` are set does the panel become a real control (`role="button"`, focusable, Enter/Space activate it, visible focus ring). `interactive` alone stays presentational-only rather than attaching button semantics to nothing. (3) The hardcoded `#33333c` hover-border hex duplicated in `Button` and `Panel` is now the named `--color-line-hover` token. One item from the original audit-fix list is still open: `BadgeTone` remains the shared six-tone type living on `Badge.tsx` rather than its own `Tone` type — small, deferred, not blocking.
