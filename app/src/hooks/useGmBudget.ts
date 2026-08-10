import { useEffect, useState } from 'react'
import { getGmBudget } from '../lib/gm'
import type { GmBudget } from '../lib/gm'

/** One cheap database read, no provider spend (`getGmBudget`'s own doc
 * comment) — a decent poll interval is nearly free, and there's no
 * event to hang a push-style refresh off (see below), so poll. */
const POLL_MS = 45_000

/** Polls the one shared daily GM budget (`lib/gm.ts`'s `getGmBudget`) —
 * play turns, rules turns, AND voice reads (`gm_turn`'s `speak` mode)
 * all draw from this same pool, per request, regardless of which of
 * the three actually spent it (`gm_turn/index.ts`'s own "two ceilings"
 * comment: the campaign-wide cap and the per-player cap are the only
 * two ceilings that exist — there is no separate one for voice).
 *
 * `JournalComposer` already reads this once on mount and again after
 * every composer-submitted Ask, which keeps its own inline meter
 * honest for AI-GM campaigns. This hook exists for the other caller
 * that has no ask to hook a refresh off of: read-aloud never goes
 * through the composer at all (`LogEntryRow` calls `startSpeaking`
 * directly), several component boundaries away, and there's no shared
 * event bus to hang a "budget changed" push notification off without
 * adding one just for this — so it polls instead.
 *
 * Returns null until the first read resolves, matching `getGmBudget`'s
 * own honest-hide-on-failure contract — treat null as "nothing to show
 * yet," never as "budget is zero." */
export function useGmBudget(campaignId: string, enabled: boolean) {
  const [budget, setBudget] = useState<GmBudget | null>(null)

  useEffect(() => {
    if (!enabled) {
      setBudget(null)
      return
    }
    let cancelled = false
    async function poll() {
      const result = await getGmBudget(campaignId)
      if (!cancelled && result) setBudget(result)
    }
    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [campaignId, enabled])

  const remaining = budget ? Math.max(0, budget.limit - budget.used) : null
  const usedFraction = budget && budget.limit > 0 ? budget.used / budget.limit : 0

  return { budget, remaining, usedFraction }
}
