import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { listEncounterMonsters } from '../lib/encounters'
import type { EncounterMonster } from '../lib/encounters'

function upsertById(prev: EncounterMonster[] | null, row: EncounterMonster): EncounterMonster[] {
  const list = prev ?? []
  const index = list.findIndex((item) => item.id === row.id)
  if (index === -1) return [...list, row]
  const next = list.slice()
  next[index] = row
  return next
}

function removeById(prev: EncounterMonster[] | null, id: string): EncounterMonster[] {
  return (prev ?? []).filter((item) => item.id !== id)
}

/**
 * `encounter_monsters`' own scoped fetch + realtime subscription —
 * deliberately NOT folded into `useCampaignRealtime`'s always-on channel
 * (see that hook's own doc comment): this table's detail is only ever
 * shown inside `EncounterPanel`, so its subscription lifecycle is scoped
 * to that component's own mount/unmount, same reasoning `scene_positions`
 * was left out of the top-level channel for. Requires migration
 * `0032_encounter_mode_realtime.sql` (adds the table to the
 * `supabase_realtime` publication) — without it this subscribes
 * successfully but never receives an event, RLS aside.
 *
 * Returns `[monsters, setMonsters]` (a `useState`-shaped pair, not a
 * bare array) — `EncounterPanel`'s own RPC wrappers (`addEncounterMonster`,
 * `damageEncounterMonster`, `setMonsterVisibility`) write their echoed
 * return value through the same setter this hook's realtime handler
 * upserts into, matching every other command surface's "echo what the
 * RPC returned, let realtime's duplicate delivery of the same row be a
 * no-op" pattern (`useCampaignRealtime`'s own doc comment).
 *
 * RLS already narrows a non-owner's `select` to `visible_to_players`
 * rows only (the `encounter_monsters_select_member` policy) — Realtime
 * re-checks that same policy per subscriber before delivering a row, so
 * a player's own `monsters` array here can never include a hidden
 * monster, no client-side filtering needed on top.
 */
export function useEncounterMonsters(campaignId: string): [EncounterMonster[] | null, Dispatch<SetStateAction<EncounterMonster[] | null>>] {
  const [monsters, setMonsters] = useState<EncounterMonster[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setMonsters(null)
    // Fetch errors surface as an empty list rather than a thrown promise
    // here -- `EncounterPanel` treats a still-`null` state as "loading",
    // so a failed initial fetch would otherwise hang that state forever
    // with nothing shown. A real error banner for this fetch specifically
    // isn't worth a second error channel alongside `onError`'s existing
    // one for the RPC calls this hook doesn't make.
    listEncounterMonsters(campaignId)
      .then((rows) => {
        if (!cancelled) setMonsters(rows)
      })
      .catch(() => {
        if (!cancelled) setMonsters([])
      })

    const channel = supabase
      .channel(`encounter-monsters-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encounter_monsters', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMonsters((prev) => removeById(prev, (payload.old as EncounterMonster).id))
          } else {
            setMonsters((prev) => upsertById(prev, payload.new as EncounterMonster))
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [campaignId])

  return [monsters, setMonsters]
}
