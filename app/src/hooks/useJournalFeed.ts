import { useCallback, useEffect, useState } from 'react'
import { listRulesChat } from '../lib/gm'
import type { GmChatMessage } from '../lib/gm'
import { listChecks } from '../lib/checks'
import type { GmCheck } from '../lib/checks'
import { buildFeed } from '../lib/feed'
import type { FeedItem } from '../lib/feed'
import type { CampaignSession, JournalEntry } from '../lib/campaigns'

/**
 * BOB_queue task 1. Pulls the `gm_chat` read and the entries+gm_chat
 * merge out of `JournalScreen.tsx`, which was already over CLAUDE.md's
 * ~300-line cap before this task added anything to it (housekeeping
 * item #6). Scoped to exactly what this task introduces —
 * `rulesMessages` and the merged feed — not a general "journal data"
 * hook: sessions/entries/characters/quests stay owned by JournalScreen
 * itself, unchanged.
 *
 * Gated on `gmEnabled`, matching every other GM surface in this app:
 * with the flag off (the default until `VITE_GM_ENABLED` is set), this
 * never calls `listRulesChat`/`listChecks` and `feedItems` is just
 * `entries` re-shaped through `buildFeed` with empty rules/checks lists
 * — no behavior change for a build where the GM doesn't exist.
 *
 * Slice 17: `checks` joins `rulesMessages` as the same shape of read —
 * gated on the same flag, refetched the same way. Deliberately gated on
 * the plain feature flag rather than the campaign's own `gm_mode`
 * (solo/ai/human): a campaign that switches away from `ai` should keep
 * showing its history, even though `JournalComposer`'s Ask chips (gated
 * separately in `JournalScreen` on `gm_mode === 'ai'`) stop offering new
 * ones.
 */
export function useJournalFeed(
  campaignId: string,
  gmEnabled: boolean,
  authorName: string,
  entries: JournalEntry[] | null,
  sessions: CampaignSession[] | null,
) {
  const [rulesMessages, setRulesMessages] = useState<GmChatMessage[] | null>(null)
  const [checks, setChecks] = useState<GmCheck[] | null>(null)

  // Exposed so JournalScreen can call it after a successful Ask Rules
  // turn — the edge function writes the new gm_chat rows server-side
  // (RulesChat.tsx's own comment: "it persists to gm_chat server-side"),
  // so the client has to refetch to see them rather than echo a result
  // it was never given. Rules turns are budget-gated and infrequent, so
  // a full refetch here costs little — same reasoning RulesChat.tsx
  // itself uses ("a cached copy goes stale the moment the player asks
  // anything").
  const refetchRules = useCallback(async () => {
    if (!gmEnabled) return
    try {
      const rows = await listRulesChat(campaignId)
      setRulesMessages(rows)
    } catch {
      // Silent, matching gm.ts's own "an unavailable read should hide,
      // never block" convention (see getGmBudget) — losing the merged
      // rules rows isn't worth a screen-level error over.
    }
  }, [campaignId, gmEnabled])

  // Slice 17: same shape as refetchRules — exposed so JournalScreen can
  // refetch after a play-mode GM turn (a `propose_check` tool call may
  // have created or superseded a check) and after a check resolves (its
  // status just changed from pending to resolved/abandoned).
  const refetchChecks = useCallback(async () => {
    if (!gmEnabled) return
    try {
      const rows = await listChecks(campaignId)
      setChecks(rows)
    } catch {
      // Same silent convention as refetchRules above.
    }
  }, [campaignId, gmEnabled])

  useEffect(() => {
    if (!gmEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRulesMessages([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecks([])
      return
    }
    void refetchRules()
    void refetchChecks()
  }, [gmEnabled, refetchRules, refetchChecks])

  const feedItems: FeedItem[] =
    entries && sessions ? buildFeed(entries, rulesMessages ?? [], checks ?? [], sessions, authorName) : []

  return { feedItems, refetchRules, refetchChecks }
}
