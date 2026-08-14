import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * BUILD_PLAN.md item 14 (realtime/presence) — the "presence" half of
 * this item, alongside `useCampaignRealtime`'s live-data-sync half.
 * Tracks who else is actually connected to this campaign right now, so
 * `PlayerCard` can show a real online dot instead of the party rail
 * looking identically "populated" whether one person or four are
 * signed in at this moment.
 *
 * Keyed by `campaign_members.id` (the same id `characters.member_id`
 * points at, and the same id `useJournalScreenData`'s `myMembership`
 * already resolves) — NOT by `auth.uid()` — so the online set can be
 * matched against a character's `member_id` directly at the render
 * site with no extra lookup.
 *
 * Uses Supabase's Presence primitive (`channel.track()` /
 * `presenceState()`), not another `postgres_changes` subscription —
 * "who's online" isn't a database row; it's a property of the open
 * websocket connection itself, and Presence is built to expire a
 * member automatically on disconnect (tab close, network drop) without
 * this app having to write or clean up any "last seen" column to get
 * that. `channel.track()` below is called with `key: myMembershipId`
 * (member, not connection) precisely so two tabs open for the SAME
 * player collapse to one online indicator rather than reading as two
 * different people — Supabase still keeps one presence entry per
 * underlying connection inside that key's slot (so `presenceState()`'s
 * value for a given key is an array, sized by however many tabs that
 * member has open), which is why this reads `Object.keys(...)` rather
 * than counting entries — the caller only ever wants "is this member
 * online," never "how many tabs."
 *
 * `myMembershipId` may still be null for a brief moment after mount
 * (`useJournalScreenData`'s own parallel load hasn't resolved yet) —
 * this hook simply doesn't track anything until it has a real id to
 * track, matching every other membership-gated read on this screen.
 */
export function useCampaignPresence(campaignId: string, myMembershipId: string | null) {
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!myMembershipId) return

    const channel = supabase.channel(`campaign-presence-${campaignId}`, {
      config: { presence: { key: myMembershipId } },
    })

    function syncOnlineIds() {
      // `presenceState()`'s keys are already the member ids we tracked
      // with above — no need to read into each key's tracked payload.
      setOnlineMemberIds(new Set(Object.keys(channel.presenceState())))
    }

    channel
      .on('presence', { event: 'sync' }, syncOnlineIds)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ memberId: myMembershipId })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [campaignId, myMembershipId])

  return onlineMemberIds
}
