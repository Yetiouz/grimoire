#!/usr/bin/env bash
# init-db.sh — build a fresh, real Grimoire schema in a disposable Postgres
# database, then apply the exact migration files this repo ships (never a
# copy, never a summary of them) plus the test-only auth shim.
#
# Needs nothing beyond a reachable Postgres server: no Docker, no Supabase
# CLI, no GoTrue. Works the same locally and in CI — only the connection
# string changes.
#
# Env vars:
#   PGURL_ADMIN   connection string to an existing maintenance database,
#                 used only to drop/recreate the test database.
#                 default: postgresql://postgres:postgres@localhost:5432/postgres
#   TEST_DB_NAME  name of the disposable database to (re)create.
#                 default: grimoire_test
#
# DATABASE_URL (the connection string tests themselves use) is derived from
# the above and printed at the end — export it before running vitest, or
# let package.json's `pretest` do that for you.

set -euo pipefail

PGURL_ADMIN="${PGURL_ADMIN:-postgresql://postgres:postgres@localhost:5432/postgres}"
TEST_DB_NAME="${TEST_DB_NAME:-grimoire_test}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../../migrations"

# Rebuild the connection string with the test database name swapped in,
# regardless of what maintenance db PGURL_ADMIN pointed at.
TEST_DB_URL="$(echo "$PGURL_ADMIN" | sed -E "s#/[^/?]+(\?.*)?\$#/${TEST_DB_NAME}\1#")"

echo "== dropping/creating ${TEST_DB_NAME} =="
psql "$PGURL_ADMIN" -v ON_ERROR_STOP=1 -c "drop database if exists ${TEST_DB_NAME};"
psql "$PGURL_ADMIN" -v ON_ERROR_STOP=1 -c "create database ${TEST_DB_NAME};"

echo "== applying auth shim =="
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/auth-shim.sql"

echo "== applying real migrations from supabase/migrations =="
for f in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$f")"

  # 0004 is a data backfill that assumes rows created outside the migration
  # chain (see fixture-seed.sql for why). Every other file is self-contained.
  if [ "$name" = "0004_black_road_import.sql" ]; then
    echo "  -- fixture seed (pre-0004 dependency) --"
    psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/fixture-seed.sql"
  fi

  echo "  -> $name"
  psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "== done =="
echo "DATABASE_URL=${TEST_DB_URL}"
