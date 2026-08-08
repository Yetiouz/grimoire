// characters.test.ts — the six character-mutation commands from 0009.
//
// Every one of these clamps or floors something (HP to [0, hp_max], XP and
// each gold currency to >= 0, gear to its capacity) — the exact kind of
// off-by-one logic that's easy to get right by eye and wrong under a real
// edge case, which is why each clamp is tested at its actual boundary
// (massive overkill damage, massive overheal) rather than with a value
// that happens to land inside the safe range either way.

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

async function fixture() {
  const { ownerId, campaign } = await createFixtureCampaign();
  const character = await createFixtureCharacter(campaign.id, {
    hp_current: 10,
    hp_max: 10,
  });
  return { ownerId, campaign, character };
}

describe("adjust_character_hp", () => {
  it("clamps massive damage at 0, not negative", async () => {
    const { ownerId, character } = await fixture();
    const updated = await callAs<{ hp_current: number }>(
      ownerId,
      "select * from adjust_character_hp($1, $2, null)",
      [character.id, -999],
    );
    expect(updated.hp_current).toBe(0);
  });

  it("clamps massive healing at hp_max, not above", async () => {
    const { ownerId, character } = await fixture();
    const updated = await callAs<{ hp_current: number }>(
      ownerId,
      "select * from adjust_character_hp($1, $2, null)",
      [character.id, 999],
    );
    expect(updated.hp_current).toBe(10);
  });

  it("writes a system journal entry only when a session id is supplied", async () => {
    const { ownerId, campaign, character } = await fixture();
    const session = await callAs<{ id: string }>(
      ownerId,
      "select * from start_session($1, $2)",
      [campaign.id, "S1"],
    );

    await callAs(ownerId, "select * from adjust_character_hp($1, $2, $3)", [
      character.id,
      -3,
      session.id,
    ]);
    const withSession = await callAs<{ count: string }>(
      ownerId,
      "select count(*)::int as count from journal_entries where session_id = $1 and kind = 'system'",
      [session.id],
    );
    expect(Number(withSession.count)).toBe(1);

    // No session id — must not throw, and must not write a second log line.
    await callAs(ownerId, "select * from adjust_character_hp($1, $2, null)", [
      character.id,
      -1,
    ]);
    const total = await callAs<{ count: string }>(
      ownerId,
      "select count(*)::int as count from journal_entries where campaign_id = $1",
      [campaign.id],
    );
    expect(Number(total.count)).toBe(1); // still just the one from the session-id call
  });

  it("rejects a non-member of the character's campaign", async () => {
    const { character } = await fixture();
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select * from adjust_character_hp($1, $2, null)", [character.id, -1]),
    );
    expect(message).toMatch(/not a member/);
  });
});

describe("adjust_character_xp", () => {
  it("floors at 0 rather than going negative", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id);
    const updated = await callAs<{ xp_current: number }>(
      ownerId,
      "select * from adjust_character_xp($1, $2, null)",
      [character.id, -50],
    );
    expect(updated.xp_current).toBe(0);
  });
});

describe("adjust_character_gold", () => {
  it("floors each of gp/sp/cp independently at 0", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gold: { gp: 5, sp: 2, cp: 0 },
    });
    const updated = await callAs<{ gold: { gp: number; sp: number; cp: number } }>(
      ownerId,
      "select * from adjust_character_gold($1, $2, $3, $4, null)",
      [character.id, -100, -100, -100],
    );
    expect(updated.gold).toEqual({ gp: 0, sp: 0, cp: 0 });
  });

  it("adds and subtracts each currency independently", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gold: { gp: 5, sp: 5, cp: 5 },
    });
    const updated = await callAs<{ gold: { gp: number; sp: number; cp: number } }>(
      ownerId,
      "select * from adjust_character_gold($1, $2, $3, $4, null)",
      [character.id, 10, -2, 0],
    );
    expect(updated.gold).toEqual({ gp: 15, sp: 3, cp: 5 });
  });
});

describe("add_character_gear / remove_character_gear", () => {
  it("adds an item and increments gear_current", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gear_current: 0,
      gear_max: 10,
    });
    const updated = await callAs<{ gear_current: number; sheet: { equipment: string[] } }>(
      ownerId,
      "select * from add_character_gear($1, $2, null)",
      [character.id, "Torch"],
    );
    expect(updated.gear_current).toBe(1);
    expect(updated.sheet.equipment).toEqual(["Torch"]);
  });

  it("rejects adding gear past capacity", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gear_current: 2,
      gear_max: 2,
    });
    const message = await expectRejection(
      callAs(ownerId, "select * from add_character_gear($1, $2, null)", [
        character.id,
        "One too many",
      ]),
    );
    expect(message).toMatch(/no free gear slots/);
  });

  it("allows unlimited gear when gear_max is null (no known cap)", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gear_current: 500,
      gear_max: null,
    });
    const updated = await callAs<{ gear_current: number }>(
      ownerId,
      "select * from add_character_gear($1, $2, null)",
      [character.id, "One more"],
    );
    expect(updated.gear_current).toBe(501);
  });

  it("removes an item by index and decrements gear_current", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      gear_current: 2,
      gear_max: 10,
      sheet: { equipment: ["Torch", "Rope"] },
    });
    const updated = await callAs<{ gear_current: number; sheet: { equipment: string[] } }>(
      ownerId,
      "select * from remove_character_gear($1, $2, null)",
      [character.id, 0],
    );
    expect(updated.sheet.equipment).toEqual(["Rope"]);
    expect(updated.gear_current).toBe(1);
  });

  it("rejects an out-of-range gear index", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      sheet: { equipment: ["Torch"] },
    });
    const message = await expectRejection(
      callAs(ownerId, "select * from remove_character_gear($1, $2, null)", [character.id, 5]),
    );
    expect(message).toMatch(/invalid gear index/);
  });
});

describe("rest_character", () => {
  it("restores hp_current to hp_max", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const character = await createFixtureCharacter(campaign.id, {
      hp_current: 1,
      hp_max: 20,
    });
    const rested = await callAs<{ hp_current: number }>(
      ownerId,
      "select * from rest_character($1, null)",
      [character.id],
    );
    expect(rested.hp_current).toBe(20);
  });
});
