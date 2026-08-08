// test-gm-turn-brakes.ts — exercises gm_turn's three loop brakes against
// the REAL deployed edge function, over real HTTPS. Not part of `pnpm
// verify` or CI: it's a network call against the live Supabase project,
// a different trust boundary than the local-Postgres command tests, and
// deliberately kept manual rather than folded into the automated gate.
//
// Why this is possible without a live model key or spending real quota:
// gm_turn's provider.ts defaults to GM_PROVIDER_MODE=stub, and stub mode
// triggers each brake off a magic string anywhere in the conversation:
//   __loop  -> the stub always proposes the identical tool call, tripping
//              brake 2 (repeat detection) -> status "looped"
//   __vary  -> the stub proposes a different tool call every round,
//              tripping brake 1 (round-trip cap) -> status "capped"
//   __hang  -> the stub never resolves until the abort signal fires,
//              tripping brake 3 (wall-clock timeout) -> status "timeout"
// If the deployed function is ever switched to GM_PROVIDER_MODE=live,
// these magic strings do nothing special — they'd just be sent to the
// real model as ordinary text, and this script's assertions would fail
// loudly rather than silently pass. That's intentional: it's the signal
// that stub mode is no longer what's live and this script needs a rethink
// before it means anything.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
//   npx tsx scripts/test-gm-turn-brakes.ts
//
// The test user must be a real, signed-up user in the project (GitHub
// OAuth is the only sign-in method the app itself offers, but Supabase
// Auth also accepts an email+password user created once via the
// dashboard — that's the intended way to give this script its own
// disposable identity rather than borrowing a real player's).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
const TEST_USER_EMAIL = requireEnv("TEST_USER_EMAIL");
const TEST_USER_PASSWORD = requireEnv("TEST_USER_PASSWORD");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

type GmTurnResponse = {
  status: string;
  message: string;
  requestCount: number;
  providerMode: string;
  [k: string]: unknown;
};

async function callGmTurn(
  jwt: string,
  campaignId: string,
  input: string,
): Promise<GmTurnResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gm_turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ campaignId, mode: "rules", input }),
  });
  if (!res.ok) {
    throw new Error(`gm_turn HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as GmTurnResponse;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (signInError || !signIn.session) {
    throw new Error(`sign-in failed: ${signInError?.message ?? "no session"}`);
  }
  const jwt = signIn.session.access_token;

  // A fresh throwaway campaign — harmless, cheap, and means this script
  // never touches a real player's data.
  const { data: campaign, error: campaignError } = await supabase.rpc("create_campaign", {
    p_name: `brake-test ${new Date().toISOString()}`,
  });
  if (campaignError || !campaign) {
    throw new Error(`could not create a test campaign: ${campaignError?.message}`);
  }
  const campaignId = (campaign as { id: string }).id;
  console.log(`Using throwaway campaign ${campaignId}. providerMode must read "stub" below —`);
  console.log(`if it reads "live", stop: these magic strings will just be sent to the real model.\n`);

  const cases: Array<{ label: string; input: string; expectStatus: string }> = [
    { label: "brake 2 — repeat detection", input: "please roll __loop for me", expectStatus: "looped" },
    { label: "brake 1 — round-trip cap", input: "please roll __vary for me", expectStatus: "capped" },
    { label: "brake 3 — wall-clock timeout", input: "please roll __hang for me", expectStatus: "timeout" },
  ];

  let failures = 0;
  for (const c of cases) {
    const start = Date.now();
    const result = await callGmTurn(jwt, campaignId, c.input);
    const elapsed = Date.now() - start;
    const pass = result.status === c.expectStatus;
    if (!pass) failures++;
    console.log(
      `[${pass ? "PASS" : "FAIL"}] ${c.label}: expected status="${c.expectStatus}", ` +
        `got "${result.status}" (${elapsed}ms, providerMode=${result.providerMode}, ` +
        `message="${result.message}")`,
    );
  }

  console.log(
    `\nNot covered by this script: the "no system pack installed" fail-loud path — that\n` +
    `needs a campaign whose \`system\` column is something other than 'shadowdark' with no\n` +
    `matching system_packs rows, and there's no command that sets \`system\` after creation\n` +
    `(by design — see 0001's schema). To check it by hand: in the Supabase SQL editor, run\n` +
    `  update campaigns set system = 'no_such_system' where id = '<this throwaway campaign>';\n` +
    `then re-run one call above against the same campaignId and confirm the reply is\n` +
    `status: "error" with a message starting "No system pack is installed for...". The\n` +
    `database-side precondition for this (that 'no_such_system' really has zero pack rows)\n` +
    `is already asserted by supabase/tests/commands/gm.test.ts.`,
  );

  if (failures > 0) {
    console.error(`\n${failures} of ${cases.length} brake(s) did not behave as expected.`);
    process.exit(1);
  }
  console.log(`\nAll ${cases.length} brakes behaved as expected.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
