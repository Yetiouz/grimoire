import { useEffect, useState } from 'react'
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
 * and don't need the edge function at all. `JournalScreen` combines
 * both hooks' results — one shared limit, two USED numbers — into the
 * header's two bars.
 *
 * Returns null until the first read resolves, matching `useGmBudget`'s
 * own honest-hide-on-failure contract — treat null as "nothing to show
 * yet," never as "zero used." */
export function useGmBudgetByMode(campaignId: string, enabled: boolean) {
  const [byMode, setByMode] = useState<GmBudgetByMode | null>(null)

  useEffect(() => {
    if (!enabled) {
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

  return byMode
}
