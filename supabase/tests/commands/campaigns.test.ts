// campaigns.test.ts — create_campaign, start_session, end_session.
//
// These three own the campaign/session lifecycle every other command
// depends on, so they're tested first and most thoroughly: the auto-close-
// on-start / no-pause-only-end behavior (Amendment 2, then its own
// follow-up in 0006) is exactly the kind of stateful rule that's easy to
// get right in the UI and wrong in a rewrite.

import { describe, it, expect, afterAll } from "vitest";
import {
  callAs,
  createTestUser,
  createFixtureCampaign,
  expectRejection,
  asAnonymous,
  closePool,
} from "../helpers/db.ts";

afterAll(closePool);

describe("create_campaign", () => {
  it("creates the campaign, auto-joins the owner, and stamps a ledger event", async () => {
    const ownerId = await createTestUser();
    const campaign = await callAs<{ id: string; name: string; owner: string }>(
      ownerId,
      "select * from create_campaign($1)",
      ["My Campaign"],
    );

    expect(campaign.name).toBe("My Campaign");
    expect(campaign.owner).toBe(ownerId);

    const member = await callAs(
      ownerId,
      "select role from campaign_members where campaign_id = $1 and user_id = $2",
      [campaign.id, ownerId],
    );
    expect(member).toMatchObject({ role: "owner" });

    const event = await callAs(
      ownerId,
      "select kind from campaign_events where campaign_id = $1 and kind = 'campaign_created'",
      [campaign.id],
    );
    expect(event).toBeTruthy();
  });

  it("rejects an unauthenticated caller", async () => {
    const message = await expectRejection(
      asAnonymous((client) => client.query("select * from create_campaign($1)", ["Nope"])),
    );
    expect(message).toMatch(/not authenticated/);
  });
});

describe("start_session", () => {
  it("numbers sessions sequentially per campaign, starting at 1", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const s1 = await callAs(ownerId, "select * from start_session($1, $2)", [
      campaign.id,
      "First",
    ]);
    expect(s1).toMatchObject({ number: 1, title: "First", ended_at: null });
  });

  it("auto-closes the currently open session before starting the next", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const s1 = await callAs<{ id: string }>(
      ownerId,
      "select * from start_session($1, $2)",
      [campaign.id, "First"],
    );
    const s2 = await callAs(ownerId, "select * from start_session($1, $2)", [
      campaign.id,
      "Second",
    ]);

    const closed = await callAs(ownerId, "select ended_at from sessions where id = $1", [
      s1.id,
    ]);
    expect((closed as { ended_at: unknown }).ended_at).not.toBeNull();
    expect(s2).toMatchObject({ number: 2, title: "Second", ended_at: null });
  });

  it("rejects a non-member", async () => {
    const { campaign } = await createFixtureCampaign();
    const outsider = await createTestUser();
    const message = await expectRejection(
      callAs(outsider, "select * from start_session($1, $2)", [campaign.id, "x"]),
    );
    expect(message).toMatch(/not a member/);
  });
});

describe("end_session", () => {
  it("closes the open session without starting a new one", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    await callAs(ownerId, "select * from start_session($1, $2)", [campaign.id, "S1"]);

    const ended = await callAs<{ ended_at: unknown }>(
      ownerId,
      "select * from end_session($1)",
      [campaign.id],
    );
    expect(ended.ended_at).not.toBeNull();

    const openCount = await callAs<{ count: string }>(
      ownerId,
      "select count(*)::int as count from sessions where campaign_id = $1 and ended_at is null",
      [campaign.id],
    );
    expect(Number(openCount.count)).toBe(0);
  });

  it("rejects ending when there is no open session", async () => {
    const { ownerId, campaign } = await createFixtureCampaign();
    const message = await expectRejection(
      callAs(ownerId, "select * from end_session($1)", [campaign.id]),
    );
    expect(message).toMatch(/no open session/);
  });
});
