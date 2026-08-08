// db.ts — the one place these tests talk to Postgres.
//
// Every SECURITY DEFINER command in this project trusts exactly one thing:
// auth.uid(). Real Supabase resolves that from the caller's JWT; the test
// database resolves it from a session-local setting (see
// setup/auth-shim.sql). asUser() is what makes that distinction invisible
// to the tests themselves — "call this command as this user" reads the
// same here as it would against the real thing.

import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/grimoire_test";

export const pool = new Pool({ connectionString: DATABASE_URL });

/** A fresh auth.users row — the only fixture every other fixture needs. */
export async function createTestUser(email?: string): Promise<string> {
  const id = randomUUID();
  await pool.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    email ?? `test-${id}@test.local`,
  ]);
  return id;
}

/** Run `fn` on a connection impersonating `userId` — auth.uid() resolves to
 * userId for every statement `fn` runs, exactly as it would for a real
 * signed-in request from that user. Always releases the connection back to
 * the pool, even if `fn` throws (an auth-boundary test's whole point is
 * that the command call throws). */
export async function asUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("select test_set_user($1)", [userId]);
    return await fn(client);
  } finally {
    client.release();
  }
}

/** The common case: call one command as one user, get its one result row.
 * Every command in this schema returns either a single row (the table it
 * just wrote) or a scalar — both come back as row 0. */
export async function callAs<T = Record<string, unknown>>(
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  return asUser(userId, async (client) => {
    const res = await client.query(sql, params);
    return res.rows[0] as T;
  });
}

/** Every command's rejection path raises a Postgres exception, which node-
 * postgres surfaces as a rejected promise with a `.message`. Tests assert
 * on that message rather than a status code — there is no HTTP layer here. */
export async function expectRejection(
  promise: Promise<unknown>,
): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the command to reject, but it succeeded");
}

/** A ready-to-use campaign, owned and joined by a fresh user. Almost every
 * command test needs one of these before it can test anything else. */
export async function createFixtureCampaign(name?: string) {
  const ownerId = await createTestUser();
  const campaign = await callAs<{ id: string; name: string; owner: string }>(
    ownerId,
    "select * from create_campaign($1)",
    [name ?? `Test Campaign ${randomUUID()}`],
  );
  return { ownerId, campaign };
}

/** There is no create-character command in this schema — production
 * characters all arrived via the 0004 data import (see setup/fixture-seed.
 * sql for why). Command tests that need a character insert one directly,
 * matching what 0004 itself does: a plain admin-connection insert, no
 * auth.uid() involved, since nothing in this project ever creates a
 * character through a SECURITY DEFINER command. */
export async function createFixtureCharacter(
  campaignId: string,
  overrides: Partial<{
    name: string;
    class_title: string;
    level: number;
    hp_current: number;
    hp_max: number;
    ac: number;
    gear_current: number | null;
    gear_max: number | null;
    gold: Record<string, number>;
    sheet: Record<string, unknown>;
  }> = {},
): Promise<{ id: string }> {
  const row = {
    name: "Test Fighter",
    class_title: "Fighter",
    level: 1,
    hp_current: 10,
    hp_max: 10,
    ac: 12,
    gear_current: 0,
    gear_max: null as number | null,
    gold: {},
    sheet: {},
    ...overrides,
  };
  const res = await pool.query(
    `insert into characters
       (campaign_id, name, class_title, level, hp_current, hp_max, ac,
        gear_current, gear_max, gold, abilities, sheet)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11)
     returning id`,
    [
      campaignId,
      row.name,
      row.class_title,
      row.level,
      row.hp_current,
      row.hp_max,
      row.ac,
      row.gear_current,
      row.gear_max,
      JSON.stringify(row.gold),
      JSON.stringify(row.sheet),
    ],
  );
  return res.rows[0];
}

export async function closePool() {
  await pool.end();
}
