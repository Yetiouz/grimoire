import { useState } from 'react'
import { logJournalEntry } from '../lib/campaigns'
import type { JournalEntry } from '../lib/campaigns'
import { askGm } from '../lib/gm'
import type { GmTurnResult } from '../lib/gm'
import { resolveCheck } from '../lib/checks'
import type { GmCheck, ResolveSource } from '../lib/checks'

/** BOB_queue task 1: "GM entries currently carry no actor_color, so set
 * it when logging and let LogEntryRow do the rest." Matches
 * index.css's `--color-cyan` and the gm-composer mockup's own cyan Ask
 * GM identity — the same accent everywhere the GM already has a color,
 * just now reaching the journal entry too. */
const GM_CYAN = '#35f0ff'

interface UseGmJournalHandlersArgs {
  campaignId: string
  sessionId: string | null
  setEntries: (updater: (prev: JournalEntry[] | null) => JournalEntry[] | null) => void
  /** `useJournalFeed`'s refetch — called after a successful Ask Rules
   * turn since the edge function writes the new `gm_chat` rows itself. */
  refetchRules: () => void | Promise<void>
  /** Slice 17: `useJournalFeed`'s check refetch — called after every
   * successful play-mode turn (a `propose_check` tool call may have
   * created or superseded a check) and after a resolve, so a card
   * appears/updates without the player reloading the page. */
  refetchChecks: () => void | Promise<void>
  /** Slice 17: `useJournalScreenData`'s own `load()` — resolve_check
   * writes a new journal_entries row (the revealed band's narration) and,
   * when the hit band carries an `hp_delta`, applies it to the character,
   * entirely server-side; neither comes back in the RPC's own return
   * value (see `lib/checks.ts`'s `ResolveCheckResult`), so the simplest
   * correct way to pick both up is the same full reload the journal
   * screen's own ErrorBanner retry path already uses. */
  reloadScreenData: () => void | Promise<void>
  /** Screen-level error surface — same one `JournalScreen`'s own
   * handleStartSession/handleEndSession already use. Unlike `askGm`
   * (which deliberately never rejects, per its own doc comment — a GM
   * failure is not a screen-level error), `resolveCheck` DOES throw on
   * failure (a double-resolve, a non-member, a missing total), the same
   * contract every other `lib/campaigns.ts` command wrapper already
   * has — so it gets the same treatment those get, not the Ask
   * handlers' swallow-and-render-inline one. */
  setError: (message: string | null) => void
}

/**
 * The Ask handlers (`handleAskGm`, `handleAskRules`) plus, Slice 17, the
 * check-resolution handler (`handleResolveCheck`) — split out of
 * `JournalScreen.tsx` alongside `useJournalScreenData`, same follow-up
 * cut. Ask* moved verbatim, not redesigned; handleResolveCheck is new.
 *
 * `handleAskGm`: Slice 16, same thin-wrapper boundary as the dice
 * roller — the composer never touches Supabase itself. No try/catch, no
 * screen-level error state: `askGm` never rejects, and a GM failure is
 * deliberately not a screen-level error — it renders inside the
 * composer and leaves everything else, Log mode included, working.
 *
 * A successful reply is written into the journal as a `narration` entry
 * authored by the GM (`actorColor: GM_CYAN`, so it renders in its own
 * color rather than falling back to the same gray a hand-typed
 * narration entry gets), the same shape the imported GM entries already
 * have. Two consequences worth knowing: out-of-character questions
 * ("remind me who X is") get logged too, because the GM has no way yet
 * to say which of its replies is narration and which is a lookup —
 * phase 3's `log_journal_entry` tool is what lets it make that call
 * itself. And journal entries can be amended but never deleted, so a
 * reply logged in error is corrected, not removed. The logging failure
 * itself is swallowed on purpose: the GM already answered, and losing
 * the entry is much better than surfacing an error over a reply the
 * player can still read in the composer.
 *
 * Slice 17: every successful play-mode turn also refetches checks — the
 * GM may have called `propose_check` (a new pending check) or, per
 * 0017's "one live check at a time" invariant, silently abandoned the
 * one that was already pending. Cheap and infrequent, same reasoning
 * `refetchRules` already uses for Ask Rules.
 *
 * `handleAskRules`: the out-of-character surface — same call, different
 * mode, deliberately no journal write. A rules answer is table talk;
 * the whole point of the separation is that it cannot end up in the
 * campaign record. It persists to `gm_chat` server-side and is read
 * back from Tools -> Rules, merged into the unified feed via
 * `refetchRules`.
 *
 * `handleResolveCheck`: the check card's Roll/physical-total controls
 * both land here — `source` is the only thing that differs between
 * them. Guards against a second call landing while one is already in
 * flight (0017's "one live check at a time" means this can only ever
 * matter for a genuine double-click/double-tap, not a real second
 * check, but it costs nothing to guard anyway). On success, the two
 * refetches run together: checks (to flip this card to resolved) and
 * the full screen reload (to pick up the narration entry and any HP
 * change resolve_check just wrote server-side). On failure, the card is
 * simply left pending — `resolvingCheckId` clears in `finally` either
 * way — and the failure surfaces the same way a failed start/end
 * session already does.
 */
export function useGmJournalHandlers({
  campaignId,
  sessionId,
  setEntries,
  refetchRules,
  refetchChecks,
  reloadScreenData,
  setError,
}: UseGmJournalHandlersArgs) {
  const [resolvingCheckId, setResolvingCheckId] = useState<string | null>(null)

  async function handleAskGm(input: string): Promise<GmTurnResult> {
    const result = await askGm(campaignId, sessionId, input)

    if (result.status === 'ok') void refetchChecks()

    // Slice 17 hotfix (2026-08-09): when the GM logged its own narration
    // via log_journal_entry this turn, that entry already exists
    // server-side — the fallback below must not also write `message` as
    // a second entry (index.ts's own `loggedByTool` comment documents
    // this invariant; it just wasn't wired up here yet). A full reload
    // is what picks the new entry up client-side, the same mechanism
    // handleResolveCheck already relies on for resolve_check's own
    // server-side writes.
    if (result.status === 'ok' && result.loggedByTool) {
      void reloadScreenData()
      return { ...result, logged: true }
    }

    if (result.status === 'ok' && result.message.trim() && sessionId) {
      try {
        const entry = await logJournalEntry({
          campaignId,
          sessionId,
          kind: 'narration',
          body: result.message.trim(),
          actorName: 'GM',
          actorColor: GM_CYAN,
        })
        setEntries((prev) => [...(prev ?? []), entry])
        return { ...result, logged: true }
      } catch {
        return { ...result, logged: false }
      }
    }

    return result
  }

  async function handleAskRules(input: string): Promise<GmTurnResult> {
    const result = await askGm(campaignId, sessionId, input, 'rules')
    if (result.status === 'ok') void refetchRules()
    return result
  }

  async function handleResolveCheck(check: GmCheck, source: ResolveSource, total?: number) {
    if (resolvingCheckId) return
    setResolvingCheckId(check.id)
    try {
      await resolveCheck(check.id, source, total)
      await Promise.all([refetchChecks(), reloadScreenData()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the check.')
    } finally {
      setResolvingCheckId(null)
    }
  }

  return { handleAskGm, handleAskRules, handleResolveCheck, resolvingCheckId }
}
