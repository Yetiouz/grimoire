import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { CampaignSession, JournalEntry } from '../lib/campaigns'
import type { Character } from '../lib/characters'

/** Upsert-by-id, matching every mutation handler in `JournalScreen.tsx`
 * (`handleLog`, `handleStartSession`, etc.) — those all echo an RPC's
 * return value straight into state, so the acting client's own change
 * is already on screen by the time this hook's own event for that same
 * row arrives a moment later over the wire. Replacing in place (rather
 * than only appending) makes that duplicate delivery a no-op instead of
 * a second row. */
function upsertById<T extends { id: string }>(prev: T[] | null, row: T): T[] {
  const list = prev ?? []
  const index = list.findIndex((item) => item.id === row.id)
  if (index === -1) return [...list, row]
  const next = list.slice()
  next[index] = row
  return next
}

function removeById<T extends { id: string }>(prev: T[] | null, id: string): T[] {
  return (prev ?? []).filter((item) => item.id !== id)
}

/**
 * BUILD_PLAN.md item 14 (realtime/presence) — until this hook, every
 * mutation on this screen only ever updated the ACTING client's own
 * state (the "echo what the RPC returned" pattern documented all over
 * `JournalScreen.tsx`/`useJournalScreenData.ts`). A second player
 * signed into the same campaign at the same time never saw any of it —
 * not a new journal entry, not a session start/pause, not an HP
 * change — until they refreshed the page. This hook is what closes
 * that gap: one Postgres Changes subscription per mount, scoped to
 * this campaign, that upserts incoming rows into the exact same
 * `useJournalScreenData` setters every RPC echo already writes into. No
 * new state shape, no parallel "remote" copy to reconcile — a realtime
 * event and a local echo are indistinguishable once they land here.
 *
 * Scoped to the three tables a live session actually mutates during
 * play — `sessions` (start/pause/resume/end), `characters` (HP/gold/
 * sheet edits), `journal_entries` (the feed) — not every table
 * `useJournalScreenData` loads. `quests`/`npcs`/`factions`/`treasure`/
 * `notes`/`locations`/`clocks` are GM-curated world content, edited
 * rarely and almost always by whoever's driving, not the "what did the
 * other player just do" signal this slice targets; they can be added
 * the same way later if that stops being true. See migration
 * `0027_realtime_publication.sql` for the publication side of this —
 * a table has to be added to `supabase_realtime` before Postgres
 * Changes will emit anything for it at all, RLS aside.
 *
 * Filtered server-side (`campaign_id=eq.${campaignId}`) rather than
 * fetching everything and filtering client-side — Realtime still
 * re-checks each table's own `_select_member` RLS policy per
 * subscriber before delivering a row, so a client can never receive a
 * row it couldn't already `SELECT`; the filter is purely to avoid
 * paying for events from every OTHER campaign this project has.
 *
 * One channel for all three tables (not three channels) — cheaper on
 * both ends, and there's no ordering dependency between them that
 * would need separate subscriptions to preserve.
 */
export function useCampaignRealtime(
  campaignId: string,
  setSessions: Dispatch<SetStateAction<CampaignSession[] | null>>,
  setEntries: Dispatch<SetStateAction<JournalEntry[] | null>>,
  setCharacters: Dispatch<SetStateAction<Character[] | null>>,
) {
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-changes-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSessions((prev) => removeById(prev, (payload.old as CampaignSession).id))
          } else {
            setSessions((prev) => upsertById(prev, payload.new as CampaignSession))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_entries', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setEntries((prev) => removeById(prev, (payload.old as JournalEntry).id))
          } else {
            setEntries((prev) => upsertById(prev, payload.new as JournalEntry))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setCharacters((prev) => removeById(prev, (payload.old as Character).id))
          } else {
            setCharacters((prev) => upsertById(prev, payload.new as Character))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [campaignId, setSessions, setEntries, setCharacters])
}
