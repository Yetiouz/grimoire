import { logJournalEntry } from '../lib/campaigns'
import type { JournalEntry } from '../lib/campaigns'
import { askGm } from '../lib/gm'
import type { GmTurnResult } from '../lib/gm'

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
}

/**
 * The two Ask handlers (`handleAskGm`, `handleAskRules`) — split out of
 * `JournalScreen.tsx` alongside `useJournalScreenData`, same follow-up
 * cut. Moved verbatim, not redesigned.
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
 * `handleAskRules`: the out-of-character surface — same call, different
 * mode, deliberately no journal write. A rules answer is table talk;
 * the whole point of the separation is that it cannot end up in the
 * campaign record. It persists to `gm_chat` server-side and is read
 * back from Tools -> Rules, merged into the unified feed via
 * `refetchRules`.
 */
export function useGmJournalHandlers({ campaignId, sessionId, setEntries, refetchRules }: UseGmJournalHandlersArgs) {
  async function handleAskGm(input: string): Promise<GmTurnResult> {
    const result = await askGm(campaignId, sessionId, input)

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

  return { handleAskGm, handleAskRules }
}
