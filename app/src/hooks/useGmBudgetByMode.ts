import { useCallback, useEffect, useState } from 'react'
import { getGmBudgetByMode } from '../lib/gm'
import type { GmBudgetByMode } from '../lib/gm'

/** Same interval as `useGmBudget` — one cheap read, no provider spend,
 * no event to hang a push-style refresh off. */
const POLL_MS = 45_000

/** Polls the by-mode split (`lib/gm.ts`'s `getGmBudgetByMode`) — sibling
 * to `useGmBudget`, same polling reasoning, but a separate hook rather
 * than folded into it: `useGmBudget` owns the shared ceiling (`limit`),
 * which only the edge function knows; this one owns the per-mode USED
 * counts, which come straight from the database via a direct RPC call
 * and don't need the edge function at all. `JournalComposer` (2026-08-10
 * fold-in) combines both hooks' results — one shared limit, two USED
 * numbers — into its own stacked GM/Voice bars, same combination
 * `JournalHeader`'s now-retired header meter used to do by hand.
 *
 * Returns null until the first read resolves, matching `useGmBudget`'s
 * own honest-hide-on-failure contract — treat null as "nothing to show
 * yet," never as "zero used." `refetch` forces an out-of-cycle read —
 * see `useGmBudget`'s own doc comment on why the composer needs one. */
export function useGmBudgetByMode(campaignId: string, enabled: boolean) {
  const [byMode, setByMode] = useState<GmBudgetByMode | null>(null)

  const refetch = useCallback(async () => {
    if (!enabled) return
    const result = await getGmBudgetByMode(campaignId)
    if (result) setByMode(result)
  }, [campaignId, enabled])

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when disabled, the canonical fetch effect
      setByMode(null)
      return
    }
    let cancelled = false
    async function poll() {
      const result = await getGmBudgetByMode(campaignId)
      if (!cancelled && result) setByMode(result)
    }
    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [campaignId, enabled])

  return { byMode, refetch }
}
