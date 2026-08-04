# Grimoire

A companion web app for running and playing Shadowdark RPG — for players, for the GM, and for AI-run tables. This is attempt two; attempt one ("Delve", repo `Yetiouz/yetidark`) is archived on its `attempt-1` branch with DB dumps — reference for lessons, never a source to copy from.

## Current state

- `index.html` — the landing page (single self-contained file, dark theme, inline styles/assets).
- `/app` — the Vite + React + TypeScript + Tailwind v4 scaffold (Milestone 1 foundation). The design system exists: a closed set of 8 named typography levels (`app/src/lib/typography.ts` — display/h1/h2/h3/body/bodySecondary/label/numeric, sized via `--text-*` theme tokens in `index.css`), a UI kit (`app/src/components/ui/` — Panel, Button, Badge, StatTile, LogEntryRow, TorchTimer, DiceResult, PortraitAvatar, SceneDivider, DangerBanner), and a living style-guide page (`app/src/pages/style-guide/`) that `App.tsx` renders directly — no router yet, nothing else to route to. Three font families: Instrument Sans (`--font-sans`, body copy and UI headings), Chivo Mono (`--font-mono`, labels/numerics/button text — a distinct technical voice for UI chrome), and Pirata One (`--font-brand`, self-hosted at `app/public/fonts/PirataOne-Regular.woff2`, brand moments only). Instrument Sans and Chivo Mono replaced an earlier Inter-only setup after a typography-inspiration pass against rig.ai — palette and Pirata One stayed as they were. `pnpm verify` (audit + typecheck + lint + test + build) is wired up locally and in `.github/workflows/verify.yml`.
- **No `pnpm-lock.yaml` committed yet.** The environment that scaffolded `/app` had `registry.npmjs.org` blocked by its network egress settings, so `pnpm install` couldn't be run there and no real lockfile could be generated — every dependency version in `app/package.json` is a hand-picked range, not something `pnpm install` has actually resolved and verified yet. CI currently runs `pnpm install --no-frozen-lockfile` as a stopgap. **As soon as `pnpm install` succeeds anywhere** (your machine, most likely), commit the resulting `app/pnpm-lock.yaml` and switch `.github/workflows/verify.yml` back to `pnpm install --frozen-lockfile` — this is a known gap to close, not a decision to leave in place.
- Repo `Yetiouz/grimoire`, linked to Vercel: every push to `main` auto-deploys (still pointed at the landing page — `/app` isn't wired to a Vercel deploy target yet).

## Decided (do not relitigate)

- TypeScript, React 18, Vite, Tailwind, Supabase, Vercel, pnpm. Single frontend, single backend.
- Design system before screens; screens compose from the UI kit. Nothing ships visually plain.
- Archived attempt-1 code is reference-only — read for lessons/shapes, never paste from it.
- No component file past ~300 lines; split instead.
- Every meaningful game-state mutation goes through an authoritative command and the append-only event ledger. The AI GM uses the same commands as a human GM.
- Every schema change is a numbered migration; rebuild + authorization tests before applying.

## Workflow rules

- Read SPEC.md before implementing anything. If a feature isn't specced, say so and ask — don't invent requirements.
- For any change touching more than one file: present a plan first, wait for approval, then implement. Full workflow is in WORKFLOW.md.
- Every task ends with evidence: test output, a build result, or a screenshot of the deployed page. Never claim done without showing the check.
- Keep the landing page (`index.html`) and the app separate. Landing-page edits must not touch app code and vice versa.
- Commit after every working slice with a descriptive message. Small commits — they double as deploys and rewind points.

## Style

- Match the landing page's design language: dark theme, CSS variables in `:root` (see `index.html` — `--bg`, `--panel`, `--purple`, etc.). In the app: Instrument Sans for body/UI text, Chivo Mono for labels/numerics/buttons, Pirata One for brand headers — see the style guide's Typography section for the full closed set.
- Shadowdark game content is third-party licensed — flag before reproducing rules text verbatim; original mechanics references are fine.
