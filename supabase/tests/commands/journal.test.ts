// journal.test.ts — log_journal_entry, amend_journal_entry.
//
// amend_journal_entry is the one command in the whole schema that performs
// an UPDATE instead of an INSERT (Amendment 1). Its entire point is that
// history still isn't lost — the prior body rides along in the ledger
// event's payload — so that's asserted explicitly, not just "the row
// changed."

import { describe, it, expect, afterAll } from "vitest";
import {
  callAs,
  createTestUser,
  createFixtureCampaign,
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

describe("log_journal_entry", () => {
  it("writes the entry and a matching ledger event", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();

    const entry = await callAs(
      ownerId,
      "select * from log_journal_entry($1, $2, $3, $4, $5, $6)",
      [campaign.id, session.id, "narration", "The party enters the dungeon.", "GM", null],
    );
    expect(entry).toMatchObject({ kind: "narration", body: "The party enters the dungeon." });

    const event = await callAs(
      ownerId,
      "select payload from campaign_events where campaign_id = $1 and kind = 'journal_entry_logged'",
      [campaign.id],
    );
    expect(event).toBeTruthy();
  });

  it("rejects a session that belongs to a different campaign", async () => {
    const a = await fixtureCampaignWithSession();
    const b = await fixtureCampaignWithSession();

    const message = await expectRejection(
      callAs(a.ownerId, "select * from log_journal_entry($1, $2, $3, $4, $5, $6)", [
        a.campaign.id,
        b.session.id, // session belongs to campaign b, not a
        "narration",
        "cross-campaign write",
        "GM",
        null,
      ]),
    );
    expect(message).toMatch(/session does not belong/);
  });

  it("rejects a non-member of the campaign", async () => {
    const { campaign, session } = await fixtureCampaignWithSession();
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select * from log_journal_entry($1, $2, $3, $4, $5, $6)", [
        campaign.id,
        session.id,
        "narration",
        "intrusion",
        "Intruder",
        null,
      ]),
    );
    expect(message).toMatch(/not a member/);
  });
});

describe("amend_journal_entry", () => {
  it("updates the body and preserves the prior body in the ledger", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const entry = await callAs<{ id: string }>(
      ownerId,
      "select * from log_journal_entry($1, $2, $3, $4, $5, $6)",
      [campaign.id, session.id, "note", "orignal typo", "GM", null],
    );

    const amended = await callAs<{ body: string }>(
      ownerId,
      "select * from amend_journal_entry($1, $2)",
      [entry.id, "original, fixed"],
    );
    expect(amended.body).toBe("original, fixed");

    const event = await callAs<{ payload: { prior_body: string; new_body: string } }>(
      ownerId,
      "select payload from campaign_events where campaign_id = $1 and kind = 'journal_entry_amended'",
      [campaign.id],
    );
    expect(event.payload.prior_body).toBe("orignal typo");
    expect(event.payload.new_body).toBe("original, fixed");
  });

  it("rejects amendment by anyone other than the original author", async () => {
    const { ownerId, campaign, session } = await fixtureCampaignWithSession();
    const entry = await callAs<{ id: string }>(
      ownerId,
      "select * from log_journal_entry($1, $2, $3, $4, $5, $6)",
      [campaign.id, session.id, "note", "mine", "GM", null],
    );

    // A second member of the same campaign, not just an outsider — proves
    // this is an authorship check, not a membership check.
    const otherMember = await createTestUser();
    await callAs(ownerId, "insert into campaign_members (campaign_id, user_id) values ($1, $2)", [
      campaign.id,
      otherMember,
    ]);

    const message = await expectRejection(
      callAs(otherMember, "select * from amend_journal_entry($1, $2)", [entry.id, "hijacked"]),
    );
    expect(message).toMatch(/only the original author/);
  });
});
