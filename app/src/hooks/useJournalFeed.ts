import { useCallback, useEffect, useState } from 'react'
import { listRulesChat } from '../lib/gm'
import type { GmChatMessage } from '../lib/gm'
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
 * never calls `listRulesChat` and `feedItems` is just `entries`
 * re-shaped through `buildFeed` with an empty rules list — no behavior
 * change for a build where the GM doesn't exist.
 */
export function useJournalFeed(
  campaignId: string,
  gmEnabled: boolean,
  authorName: string,
  entries: JournalEntry[] | null,
  sessions: CampaignSession[] | null,
) {
  const [rulesMessages, setRulesMessages] = useState<GmChatMessage[] | null>(null)

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

  useEffect(() => {
    if (!gmEnabled) {
      setRulesMessages([])
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchRules()
  }, [gmEnabled, refetchRules])

  const feedItems: FeedItem[] =
    entries && sessions ? buildFeed(entries, rulesMessages ?? [], sessions, authorName) : []

  return { feedItems, refetchRules }
}
