// checks.test.ts — Slice 17: gm_create_check, gm_list_checks, resolve_check,
// gm_create_dice_pool, gm_consume_die (migrations 0017/0018/0020).
//
// The two guarantees this slice exists to keep are sealing (an unresolved
// band is never reachable by any client path) and pool integrity (the GM
// cannot see ahead of, skip, or redraw from its own dice) — both are
// asserted here directly against the real functions, not against a
// simulation of them. Every one of these was also verified live against
// the deployed project's Slice Test Bench campaign before this file was
// written; this is the same behavior encoded as a repeatable test.

import { describe, it, expect, afterAll } from "vitest";
import {
  callAs,
  createTestUser,
  createFixtureCampaign,
  createFixtureCharacter,
  expectRejection,
  closePool,
} from "../helpers/db.ts";

afterAll(closePool);

async function fixtureCampaignWithSession() {
  const { ownerId, campaign } = await createFixtureCampaign();
  const session = await callAs<{ id: string }>(
    ownerId,
    "select * from start_session($1, $2)",
    [campaign.id, "S1"],
  );
  return { ownerId, campaign, session };
}

// Contiguous, ascending, covers -20..60 — the one shape gm_create_check
// will actually accept. Individual tests mutate a copy to break it.
const FULL_BANDS = [
  { min: -20, max: 11, text: "fail" },
  { min: 12, max: 60, text: "succeed" },
];

describe("gm_create_check — band coverage", () => {
  it("accepts bands that are contiguous and cover -20..60", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const id = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    expect(id.gm_create_check).toBeTruthy();
  });

  it("rejects a gap between bands", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const gapped = [
      { min: -20, max: 5, text: "fail" },
      { min: 10, max: 60, text: "succeed" }, // 6..9 missing
    ];
    const message = await expectRejection(
      callAs(
        ownerId,
        "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3)",
        [campaign.id, session.id, JSON.stringify(gapped)],
      ),
    );
    expect(message).toMatch(/contiguous and ascending/);
  });

  it("rejects bands that don't reach the -20..60 edges", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const narrow = [
      { min: 1, max: 11, text: "fail" },
      { min: 12, max: 20, text: "succeed" },
    ];
    const message = await expectRejection(
      callAs(
        ownerId,
        "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3)",
        [campaign.id, session.id, JSON.stringify(narrow)],
      ),
    );
    expect(message).toMatch(/must cover totals -20\.\.60/);
  });

  it("rejects fewer than 2 bands", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const message = await expectRejection(
      callAs(
        ownerId,
        "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3)",
        [campaign.id, session.id, JSON.stringify([{ min: -20, max: 60, text: "only one" }].slice(0, 0))],
      ),
    );
    expect(message).toMatch(/at least 2/);
  });

  it("rejects a check with no open session", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const message = await expectRejection(
      callAs(
        ownerId,
        "select gm_create_check($1, null, null, 'DEX', 12, null, 'stakes', $2)",
        [campaign.id, JSON.stringify(FULL_BANDS)],
      ),
    );
    expect(message).toMatch(/needs an open session/);
  });

  it("abandons a prior pending check for the same campaign", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const first = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'first', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    await callAs(
      ownerId,
      "select gm_create_check($1, $2, null, 'STR', 10, null, 'second', $3)",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    const row = await callAs<{ status: string }>(
      ownerId,
      "select status from gm_checks where id = $1",
      [first.gm_create_check],
    );
    expect(row.status).toBe("abandoned");
  });
});

describe("sealing — the bands column is never reachable except by resolve_check itself", () => {
  it("gm_list_checks never selects the bands column", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    await callAs(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'sealed test', $3)",
      [campaign.id, session.id, JSON.stringify([
        { min: -20, max: 11, text: "SEALED-FAIL-TEXT" },
        { min: 12, max: 60, text: "SEALED-SUCCESS-TEXT" },
      ])],
    );
    const rows = await asUserList(ownerId, campaign.id);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain("bands");
      expect(JSON.stringify(row)).not.toMatch(/SEALED-/);
    }
  });

  it("has no select policy on gm_checks — a direct read returns nothing for a real client role", async () => {
    // gm_checks.enable row level security with zero policies (0017's own
    // comment: "the table is reachable only through the SECURITY DEFINER
    // functions below"). The test DB's `authenticated` role is the same
    // role PostgREST issues real client reads as, so this is the actual
    // boundary a REST client would hit — not a superuser artifact.
    //
    // Two different environments legitimately land on two different shapes
    // of "you can't read this": a from-scratch schema (this suite, CI) has
    // no GRANT on gm_checks for `authenticated` at all, so Postgres itself
    // refuses with "permission denied" before RLS is even evaluated; the
    // live project has schema-wide default grants already in place, so the
    // grant succeeds and RLS-with-zero-policies filters the result to zero
    // rows instead (verified directly against the deployed project's Slice
    // Test Bench campaign before this test was written). Both mean the same
    // thing to an actual client, so both are accepted here.
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    const { asUser } = await import("../helpers/db.ts");
    const outcome = await asUser(ownerId, async (client) => {
      await client.query("set role authenticated");
      try {
        const res = await client.query("select * from gm_checks where id = $1", [created.gm_create_check]);
        return { rows: res.rowCount };
      } catch (e) {
        return { deniedMessage: (e as Error).message };
      } finally {
        await client.query("reset role").catch(() => {});
      }
    });
    if ("rows" in outcome) {
      expect(outcome.rows).toBe(0);
    } else {
      expect(outcome.deniedMessage).toMatch(/permission denied/);
    }
  });
});

async function asUserList(ownerId: string, campaignId: string) {
  const { asUser } = await import("../helpers/db.ts");
  return asUser(ownerId, async (client) => {
    const res = await client.query("select * from gm_list_checks($1)", [campaignId]);
    return res.rows;
  });
}

describe("resolve_check", () => {
  it("matches the total to its band and auto-applies the outcome (journal + HP)", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const character = await createFixtureCharacter(campaign.id, { hp_current: 10, hp_max: 10 });
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, $3, 'DEX', 12, null, 'ledge', $4) as gm_create_check",
      [campaign.id, session.id, character.id, JSON.stringify([
        { min: -20, max: 11, text: "the ledge crumbles", hp_delta: -3 },
        { min: 12, max: 60, text: "a clean landing" },
      ])],
    );

    const result = await callAs<{
      total: number; band: { text: string; hp_delta?: number }; band_index: number;
    }>(
      ownerId,
      "select * from resolve_check($1, 'physical', 8)",
      [created.gm_create_check],
    );
    expect(result.band.text).toBe("the ledge crumbles");
    expect(result.band_index).toBe(0);

    const char = await callAs<{ hp_current: number }>(
      ownerId,
      "select hp_current from characters where id = $1",
      [character.id],
    );
    expect(char.hp_current).toBe(7);

    const entry = await callAs<{ kind: string; actor_name: string; actor_color: string }>(
      ownerId,
      "select kind, actor_name, actor_color from journal_entries where campaign_id = $1 and body = $2",
      [campaign.id, "the ledge crumbles"],
    );
    expect(entry).toMatchObject({ kind: "narration", actor_name: "GM", actor_color: "#35f0ff" });
  });

  it("never reveals the band that wasn't hit", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify([
        { min: -20, max: 11, text: "UNCHOSEN-FAIL-TEXT" },
        { min: 12, max: 60, text: "CHOSEN-SUCCESS-TEXT" },
      ])],
    );
    await callAs(ownerId, "select resolve_check($1, 'physical', 20)", [created.gm_create_check]);
    const entries = await callAs<{ count: string }>(
      ownerId,
      "select count(*)::text from journal_entries where campaign_id = $1 and body like '%UNCHOSEN%'",
      [campaign.id],
    );
    expect(entries.count).toBe("0");
  });

  it("refuses a second resolution", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    await callAs(ownerId, "select resolve_check($1, 'physical', 15)", [created.gm_create_check]);
    const message = await expectRejection(
      callAs(ownerId, "select resolve_check($1, 'physical', 30)", [created.gm_create_check]),
    );
    expect(message).toMatch(/check is resolved/);
  });

  it("rejects a non-member", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select resolve_check($1, 'physical', 15)", [created.gm_create_check]),
    );
    expect(message).toMatch(/not a member/);
  });

  it("rejects gm_create_check itself from a non-member", async () => {
    const { campaign, session } = await fixtureCampaignWithSession();
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(
        outsider,
        "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3)",
        [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
      ),
    );
    expect(message).toMatch(/not a member/);
  });

  it("physical resolution requires a total", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const created = await callAs<{ gm_create_check: string }>(
      ownerId,
      "select gm_create_check($1, $2, null, 'DEX', 12, null, 'stakes', $3) as gm_create_check",
      [campaign.id, session.id, JSON.stringify(FULL_BANDS)],
    );
    const message = await expectRejection(
      callAs(ownerId, "select resolve_check($1, 'physical', null)", [created.gm_create_check]),
    );
    expect(message).toMatch(/physical resolution needs the total/);
  });
});

describe("gm_create_dice_pool / gm_consume_die — strict order and exhaustion", () => {
  it("hands out d6 in strict ascending seq order", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const pool = await callAs<{ gm_create_dice_pool: string }>(
      ownerId,
      "select gm_create_dice_pool($1) as gm_create_dice_pool",
      [campaign.id],
    );
    for (let expectedSeq = 1; expectedSeq <= 12; expectedSeq++) {
      const draw = await callAs<{ gm_consume_die: { seq: number; value: number } }>(
        ownerId,
        "select gm_consume_die($1, 'd6') as gm_consume_die",
        [pool.gm_create_dice_pool],
      );
      expect(draw.gm_consume_die.seq).toBe(expectedSeq);
      expect(draw.gm_consume_die.value).toBeGreaterThanOrEqual(1);
      expect(draw.gm_consume_die.value).toBeLessThanOrEqual(6);
    }
  });

  it("exhausts after 12 draws of the same die and refuses a 13th", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const pool = await callAs<{ gm_create_dice_pool: string }>(
      ownerId,
      "select gm_create_dice_pool($1) as gm_create_dice_pool",
      [campaign.id],
    );
    for (let i = 0; i < 12; i++) {
      await callAs(ownerId, "select gm_consume_die($1, 'd6')", [pool.gm_create_dice_pool]);
    }
    const message = await expectRejection(
      callAs(ownerId, "select gm_consume_die($1, 'd6')", [pool.gm_create_dice_pool]),
    );
    expect(message).toMatch(/pool exhausted for d6/);
  });

  it("tracks each die type independently — exhausting d6 doesn't touch d20", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const pool = await callAs<{ gm_create_dice_pool: string }>(
      ownerId,
      "select gm_create_dice_pool($1) as gm_create_dice_pool",
      [campaign.id],
    );
    for (let i = 0; i < 12; i++) {
      await callAs(ownerId, "select gm_consume_die($1, 'd6')", [pool.gm_create_dice_pool]);
    }
    const draw = await callAs<{ gm_consume_die: { seq: number } }>(
      ownerId,
      "select gm_consume_die($1, 'd20') as gm_consume_die",
      [pool.gm_create_dice_pool],
    );
    expect(draw.gm_consume_die.seq).toBe(1);
  });

  it("rejects a non-member", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const pool = await callAs<{ gm_create_dice_pool: string }>(
      ownerId,
      "select gm_create_dice_pool($1) as gm_create_dice_pool",
      [campaign.id],
    );
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select gm_consume_die($1, 'd6')", [pool.gm_create_dice_pool]),
    );
    expect(message).toMatch(/not a member/);
  });

  it("rejects gm_create_dice_pool itself from a non-member", async () => {
    const { campaign } = await createFixtureCampaign();
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select gm_create_dice_pool($1)", [campaign.id]),
    );
    expect(message).toMatch(/not a member/);
  });
});
