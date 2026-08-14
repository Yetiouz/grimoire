import { adjustClock, createClock, deleteClock, updateClock } from '../lib/world'

/**
 * `WorldTabs`' clock mutation handlers (BUILD_PLAN.md item 15 slice 2),
 * split into their own hook purely for CLAUDE.md's ~300-line file cap —
 * `WorldTabs.tsx` was already dense with six tabs' worth of render
 * logic before this slice, and four owner-only RPC wrappers plus their
 * doc comments pushed it well past 300 lines. Pure extraction, no
 * behavior change: every function here is exactly what lived inline in
 * `WorldTabs` before, just given a home. Not a general "clock data"
 * hook — `clocks` itself still lives in `useJournalScreenData`
 * (`WorldTabs` receives it as a normal prop); this only wraps the
 * write half.
 *
 * Each handler is "call the RPC, then re-fetch" — `reloadClocks` (the
 * caller's targeted re-fetch, see that function's own doc comment in
 * `useJournalScreenData.ts`) rather than echoing the RPC's return value
 * locally, unlike most other mutations in this app
 * (`adjustCharacterHp`/`handleCharacterUpdate` and friends). A refetch
 * is simple and correct here and clocks are a low-frequency, GM-only
 * action (nothing else on screen updates in response to one), so the
 * extra round trip isn't worth optimizing away the way it would be for
 * something on the hot path like HP.
 */
export function useClockMutations(campaignId: string, reloadClocks: () => Promise<void>) {
  async function handleAdjustClock(clockId: string, delta: number) {
    await adjustClock(clockId, delta)
    await reloadClocks()
  }

  async function handleUpdateClock(
    clockId: string,
    fields: { name: string; description: string; segments: number; factionId: string | null; revealed: boolean },
  ) {
    await updateClock(clockId, fields)
    await reloadClocks()
  }

  async function handleDeleteClock(clockId: string) {
    await deleteClock(clockId)
    await reloadClocks()
  }

  async function handleCreateClock(fields: { name: string; segments: number; description: string; factionId: string | null }) {
    await createClock(campaignId, fields.name, fields.segments, fields.description, fields.factionId ?? undefined)
    await reloadClocks()
  }

  return { handleAdjustClock, handleUpdateClock, handleDeleteClock, handleCreateClock }
}
