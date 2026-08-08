import { supabase } from './supabase'

/** Every outcome the `gm_turn` edge function can report. Note that none
 * of these are exceptional: the function deliberately answers HTTP 200
 * with a structured body on every path, including its own failures, so
 * that a bad turn renders as a message rather than an unhandled throw.
 * (`capped` / `looped` / `timeout` are its three loop brakes.) */
export type GmTurnStatus =
  | 'ok'
  | 'capped'
  | 'looped'
  | 'timeout'
  | 'budget_exhausted'
  | 'disabled'
  | 'error'

export interface GmBudget {
  used: number
  limit: number
}

/** `play` is in-fiction and lands in the journal. `rules` is
 * out-of-character table talk that never touches it — see `gm_chat`. */
export type GmMode = 'play' | 'rules'

export interface GmChatMessage {
  id: string
  role: 'user' | 'assistant'
  body: string
  created_at: string
}

export interface GmTurnResult {
  status: GmTurnStatus
  message: string
  /** Provider requests this turn actually spent — 1 for a clean turn,
   * more when the GM used tools. Free-tier quota is counted in requests,
   * not tokens, which is why this is the number surfaced to the user. */
  requestCount: number
  /** `stub` until MODEL_* secrets are set and GM_PROVIDER_MODE is
   * flipped to `live`; surfaced so the UI can be honest about whether a
   * reply came from a real model. */
  providerMode?: string
  budget?: GmBudget
  resetsAt?: string
  /** Echoed back by the edge function so the UI can tell a rules answer
   * from a GM turn without threading the request mode through. */
  mode?: GmMode
  /** Set by the screen, not the edge function: whether a successful reply
   * made it into the journal. `false` means the GM answered but the entry
   * write failed, which the composer surfaces rather than losing silently.
   * Undefined for every non-`ok` status. */
  logged?: boolean
}

/** Client-side ceiling, deliberately slightly longer than the edge
 * function's own 60s abort so the server normally wins and can record
 * telemetry. This exists only for the case where the request never
 * reaches the function at all (offline, DNS, a dead tab waking up) —
 * without it the composer would spin forever on a promise that never
 * settles, which is exactly the lockout this slice set out to remove. */
const CLIENT_TIMEOUT_MS = 65_000

/** Wraps the `gm_turn` edge function (slice 16). Mirrors `dice.ts`'s
 * boundary rule — no UI knowledge, no journal writes, callers decide
 * what to do with the result.
 *
 * Unlike `rollDice`, this **never rejects**. Transport failures are
 * normalised into an `error` result, because a thrown promise here is
 * how the composer would get stuck: the whole point of the design is
 * that no GM failure can leave the UI unusable. Callers should switch
 * on `status`, not wrap this in try/catch. */
export async function askGm(
  campaignId: string,
  sessionId: string | null,
  input: string,
  mode: GmMode = 'play',
): Promise<GmTurnResult> {
  try {
    const result = await Promise.race([
      supabase.functions.invoke('gm_turn', {
        body: { campaignId, sessionId, input, mode },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('The GM did not respond.')), CLIENT_TIMEOUT_MS),
      ),
    ])

    if (result.error) {
      return {
        status: 'error',
        message: result.error.message || 'Could not reach the GM.',
        requestCount: 0,
      }
    }

    const data = result.data as Partial<GmTurnResult> | null
    if (!data?.status) {
      return { status: 'error', message: 'The GM sent something unreadable.', requestCount: 0 }
    }

    return {
      status: data.status,
      message: data.message ?? '',
      requestCount: data.requestCount ?? 0,
      mode: data.mode,
      providerMode: data.providerMode,
      budget: data.budget,
      resetsAt: data.resetsAt,
    }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not reach the GM.',
      requestCount: 0,
    }
  }
}

/** The rules-chat transcript, oldest first. Read directly rather than
 * through the edge function: it's an ordinary member-scoped select, and
 * routing it through the function would cost an invocation for no gain. */
export async function listRulesChat(campaignId: string): Promise<GmChatMessage[]> {
  const { data, error } = await supabase
    .from('gm_chat')
    .select('id, role, body, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as GmChatMessage[]
}

/** Reads the day's budget without spending anything. The edge function
 * answers a `probe` with a budget-only reply: no model call, no
 * telemetry row, one cheap database read.
 *
 * It has to come from the function rather than being computed here,
 * because the ceiling lives in `GM_DAILY_REQUEST_BUDGET` on the server.
 * Mirroring it into a `VITE_` variable would give two sources of truth
 * that drift the first time one is changed without the other.
 *
 * Returns null on any failure — an unavailable counter should hide,
 * never block the composer or raise an error. */
export async function getGmBudget(campaignId: string): Promise<GmBudget | null> {
  try {
    const { data, error } = await supabase.functions.invoke('gm_turn', {
      body: { campaignId, probe: true },
    })
    if (error) return null
    const budget = (data as { budget?: GmBudget } | null)?.budget
    return budget ?? null
  } catch {
    return null
  }
}

/** True when the GM is switched on for this build. Off by default:
 * slice 16 ships to `main` while The Black Road is live data, so the
 * feature stays dark until the flag is set deliberately — locally in
 * `.env.local` and, separately, in Vercel's environment variables for
 * the deployed app you test on your phone. */
export const gmEnabled = import.meta.env.VITE_GM_ENABLED === 'true'
