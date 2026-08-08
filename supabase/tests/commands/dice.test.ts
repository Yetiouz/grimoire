// dice.test.ts — roll_dice. Server-authoritative RNG: the whole point is
// that a client can't fake or replay a result, so what's actually worth
// testing is the contract (valid dice, valid modes, count bounds,
// advantage/disadvantage keeps the right set) rather than randomness
// itself. Runs each roll many times where the assertion is about the
// *range*, since a single roll proves nothing about a die that can land
// anywhere in [1, faces].

import { describe, it, expect, afterAll } from "vitest";
import { callAs, createFixtureCampaign, expectRejection, closePool } from "../helpers/db.ts";

afterAll(closePool);

type RollResult = {
  die: string;
  count: number;
  mode: string;
  rolls: number[];
  otherRolls: number[] | null;
  total: number;
};

describe("roll_dice", () => {
  it("rolls within [1, faces] for every supported die", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const dice = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
    const faces: Record<string, number> = {
      d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100,
    };

    for (const die of dice) {
      for (let i = 0; i < 20; i++) {
        const result = await callAs<{ roll_dice: RollResult }>(
          ownerId,
          "select roll_dice($1, $2, 1, 'normal') as roll_dice",
          [campaign.id, die],
        );
        const [roll] = result.roll_dice.rolls;
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(faces[die]);
      }
    }
  });

  it("sums multiple dice correctly", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const result = await callAs<{ roll_dice: RollResult }>(
      ownerId,
      "select roll_dice($1, 'd6', 4, 'normal') as roll_dice",
      [campaign.id],
    );
    expect(result.roll_dice.rolls).toHaveLength(4);
    expect(result.roll_dice.total).toBe(result.roll_dice.rolls.reduce((a, b) => a + b, 0));
  });

  it("advantage keeps the higher-sum set, disadvantage the lower", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    for (const mode of ["advantage", "disadvantage"] as const) {
      const result = await callAs<{ roll_dice: RollResult }>(
        ownerId,
        "select roll_dice($1, 'd20', 1, $2) as roll_dice",
        [campaign.id, mode],
      );
      const kept = result.roll_dice.total;
      const other = result.roll_dice.otherRolls?.[0] ?? kept;
      if (mode === "advantage") {
        expect(kept).toBeGreaterThanOrEqual(other);
      } else {
        expect(kept).toBeLessThanOrEqual(other);
      }
    }
  });

  it("rejects an unsupported die", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const message = await expectRejection(
      callAs(ownerId, "select roll_dice($1, 'd3', 1, 'normal')", [campaign.id]),
    );
    expect(message).toMatch(/unsupported die/);
  });

  it("rejects a count outside 1..20", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const tooMany = await expectRejection(
      callAs(ownerId, "select roll_dice($1, 'd6', 21, 'normal')", [campaign.id]),
    );
    expect(tooMany).toMatch(/count must be between/);

    const tooFew = await expectRejection(
      callAs(ownerId, "select roll_dice($1, 'd6', 0, 'normal')", [campaign.id]),
    );
    expect(tooFew).toMatch(/count must be between/);
  });

  it("rejects an unsupported mode", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const message = await expectRejection(
      callAs(ownerId, "select roll_dice($1, 'd6', 1, 'lucky')", [campaign.id]),
    );
    expect(message).toMatch(/unsupported mode/);
  });
});
