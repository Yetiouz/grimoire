# Command-layer tests

Tests every `SECURITY DEFINER` command against a real, disposable Postgres
database built from this repo's actual migration files — not a mock, not a
description of them. No Docker, no Supabase CLI, no GoTrue: a ~15-line
`auth` schema shim stands in for Supabase's real one (see
`setup/auth-shim.sql` for exactly what it does and doesn't reproduce).

## Running locally

You need a Postgres server reachable at `PGURL_ADMIN` (default
`postgresql://postgres:postgres@localhost:5432/postgres` — override if
your local Postgres uses different credentials or a different port).

```bash
cd supabase/tests
pnpm install --no-frozen-lockfile   # no lockfile yet, same stopgap app/ uses
pnpm db:setup                       # rebuilds grimoire_test from scratch
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/grimoire_test pnpm test
```

`db:setup` always drops and recreates `grimoire_test` — it's meant to run
before every test session, not once ever. It applies, in order: the auth
shim, then every file in `../migrations/*.sql`, with one fixture-seed step
injected immediately before `0004_black_road_import.sql` (that migration
assumes a campaign and three users that existed in production before it
ran, outside the migration chain itself — see `setup/fixture-seed.sql` for
the full explanation; this was discovered by actually running the chain
from scratch, not by reading the file).

## What this does and doesn't cover

**Covered:** every `SECURITY DEFINER` command's happy path, its
`auth.uid()`/membership checks, and its command-specific edge cases (HP/XP/
gold clamping, gear capacity, budget arithmetic, session lifecycle). This
is the entire write path in this schema — no table has an INSERT/UPDATE
policy, so if a command allows something it shouldn't, there's no RLS
policy standing behind it to catch it.

**Not covered here:** the RLS SELECT policies themselves (e.g., "can a
non-member read another campaign's journal," "is a gm_chat row really
private to its author"). Every test connection in this suite runs as the
Postgres superuser, which bypasses RLS entirely — auth.uid() impersonation
via `test_set_user()` is what the commands themselves check internally, not
what RLS evaluates against. Testing the SELECT-policy layer would mean
connecting as the actual `authenticated` role with `SET ROLE` plus
Supabase's schema-wide default grants (which are project setup, not
anything any migration file creates) — a real but separate piece of work,
not folded into "command-layer tests" here.

**Not covered here:** `gm_turn` itself. It's a Deno edge function, not
reachable from a Postgres connection — see `../../scripts/
test-gm-turn-brakes.ts` for its three loop brakes, run manually against the
live deployed function rather than as part of this suite.

## Files

- `setup/auth-shim.sql` — the `auth.uid()` stand-in and the `anon`/
  `authenticated`/`service_role` roles every migration's grants reference.
  Never applied anywhere but this disposable database.
- `setup/fixture-seed.sql` — the pre-`0004` dependency, documented in place.
- `setup/init-db.sh` — orchestrates the above against `../migrations/*.sql`.
- `helpers/db.ts` — `asUser()`/`callAs()` (impersonate a user for one call),
  `createTestUser()`, `createFixtureCampaign()`, `createFixtureCharacter()`
  (there's no create-character command — production characters all arrived
  via the `0004` import, so fixtures insert directly, same as that
  migration does), `expectRejection()`.
- `commands/*.test.ts` — one file per command group.
