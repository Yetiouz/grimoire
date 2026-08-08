// gm.test.ts — the AI GM's telemetry/budget commands (0010-0013) and the
// system_packs precondition gm_turn's edge function relies on.
//
// gm_turn itself (the Deno edge function) isn't reachable from here — it's
// tested separately, over HTTP, against the deployed function (see
// scripts/test-gm-turn-brakes.ts). What lives here is everything gm_turn
// calls back into Postgres for: recording a turn, recording a chat
// message, and reading the shared/per-player budget. The "no system pack
// installed" case gm_turn is meant to fail loudly on is a real, reachable
// database state — asserted directly here — even though the loud-failure
// behavior itself is edge-function code, not SQL.

import { describe, it, expect, afterAll } from "vitest";
import { callAs, createFixtureCampaign, pool, closePool } from "../helpers/db.ts";

afterAll(closePool);

describe("gm_record_turn", () => {
  it("records a turn and defaults mode to 'play'", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const turnId = await callAs<{ gm_record_turn: string }>(
      ownerId,
      `select gm_record_turn($1, null, 'ok', 2, 100, 50, null, null, null) as gm_record_turn`,
      [campaign.id],
    );
    expect(turnId.gm_record_turn).toBeTruthy();

    const row = await callAs<{ mode: string; status: string }>(
      ownerId,
      "select mode, status from gm_turns where id = $1",
      [turnId.gm_record_turn],
    );
    expect(row).toMatchObject({ mode: "play", status: "ok" });
  });

  it("records the rules mode when passed explicitly", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const turnId = await callAs<{ gm_record_turn: string }>(
      ownerId,
      `select gm_record_turn($1, null, 'ok', 1, null, null, null, null, null, 'rules') as gm_record_turn`,
      [campaign.id],
    );
    const row = await callAs<{ mode: string }>(
      ownerId,
      "select mode from gm_turns where id = $1",
      [turnId.gm_record_turn],
    );
    expect(row.mode).toBe("rules");
  });
});

describe("gm_record_chat", () => {
  it("records a chat message for the caller", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const row = await callAs<{ role: string; body: string; user_id: string }>(
      ownerId,
      "select * from gm_record_chat($1, $2, $3)",
      [campaign.id, "user", "how does advantage work?"],
    );
    expect(row).toMatchObject({ role: "user", body: "how does advantage work?", user_id: ownerId });
  });
});

describe("gm_budget_since", () => {
  it("sums campaign-wide usage and the caller's own slice separately", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const otherMember = (await createFixtureCampaign()).ownerId;
    await callAs(ownerId, "insert into campaign_members (campaign_id, user_id) values ($1, $2)", [
      campaign.id,
      otherMember,
    ]);

    const since = new Date(Date.now() - 60_000).toISOString();

    // Owner spends 3 requests, the other member spends 2 — same campaign.
    await callAs(ownerId, `select gm_record_turn($1, null, 'ok', 3, null, null, null, null, null)`, [campaign.id]);
    await callAs(otherMember, `select gm_record_turn($1, null, 'ok', 2, null, null, null, null, null)`, [campaign.id]);

    const budget = await callAs<{ campaign_used: number; user_used: number }>(
      ownerId,
      "select * from gm_budget_since($1, $2)",
      [campaign.id, since],
    );
    expect(budget.campaign_used).toBe(5); // the whole table's shared spend
    expect(budget.user_used).toBe(3); // only the caller's own
  });
});

describe("system_packs precondition for gm_turn's fail-loud path", () => {
  it("has pack rows for shadowdark (the only system this project ships)", async () => {
    const res = await pool.query(
      "select count(*)::int as count from system_packs where system = $1",
      ["shadowdark"],
    );
    expect(res.rows[0].count).toBeGreaterThan(0);
  });

  it("has zero pack rows for a system nobody has installed yet — the exact state gm_turn/index.ts checks for and refuses to run a persona-less GM against", async () => {
    const res = await pool.query(
      "select count(*)::int as count from system_packs where system = $1",
      ["mork_borg"],
    );
    expect(res.rows[0].count).toBe(0);
  });
});
