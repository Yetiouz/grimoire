import { supabase } from './supabase'

/** Every outcome the `gm_turn` edge function can report, plus one the
 * CLIENT reports on its own: `stopped`, added 2026-08-18 when the
 * composer's send button became a real Stop control (see `askGm`'s
 * `signal` param below). Every other member of this union is exceptional
 * only insofar as the edge function deliberately answers HTTP 200 with a
 * structured body on every path, including its own failures, so that a
 * bad turn renders as a message rather than an unhandled throw.
 * (`capped` / `looped` / `timeout` are its three loop brakes.) `stopped`
 * fits the same "not an error, a real outcome" shape, which is exactly
 * why `GmReply` needed no changes to render it: its tone switch already
 * buckets anything that isn't `ok`/`budget_exhausted`/`error` into the
 * yellow "Stopped" tone (`capped`/`looped`/`timeout` all shared that
 * label already), and `stopped` falls into that same bucket for free. */
export type GmTurnStatus =
  | 'ok'
  | 'capped'
  | 'looped'
  | 'timeout'
  | 'stopped'
  | 'budget_exhausted'
  | 'disabled'
  | 'error'

export interface GmBudget {
  /** Campaign-wide spend today. Everyone at the table draws on one
   * provider key, so this — not your own usage — is the real ceiling. */
  used: number
  limit: number
  /** Your own slice of it. Equal to the campaign limit while you're
   * playing solo, which is why the counter reads the same either way
   * until someone else joins. */
  yours?: number
  yourLimit?: number
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
  /** From the edge function directly (unlike `logged`, above): true when
   * the GM logged its own narration via the log_journal_entry tool this
   * turn. The screen's pre-slice-17 fallback (auto-logging `message` as
   * a journal entry) must run only when this is false, or the same
   * narration lands twice — see useGmJournalHandlers.ts's handleAskGm. */
  loggedByTool?: boolean
}

/** Client-side ceiling, deliberately slightly longer than the edge
 * function's own 60s abort so the server normally wins and can record
 * telemetry. This exists only for the case where the request never
 * reaches the function at all (offline, DNS, a dead tab waking up) —
 * without it the composer would spin forever on a promise that never
 * settles, which is exactly the lockout this slice set out to remove. */
const CLIENT_TIMEOUT_MS = 65_000

/** Distinguishes a stop from the invoke/timeout branches in the race
 * below without risking a false match against real response data (an
 * object shape like `{ stopped: true }` could theoretically collide
 * with something the edge function returns; a module-private Symbol
 * can't). */
const STOPPED = Symbol('askGm-stopped')

/** Wraps the `gm_turn` edge function (slice 16). Mirrors `dice.ts`'s
 * boundary rule — no UI knowledge, no journal writes, callers decide
 * what to do with the result.
 *
 * Unlike `rollDice`, this **never rejects**. Transport failures are
 * normalised into an `error` result, because a thrown promise here is
 * how the composer would get stuck: the whole point of the design is
 * that no GM failure can leave the UI unusable. Callers should switch
 * on `status`, not wrap this in try/catch. A stop (`signal`, below)
 * keeps that same contract — it resolves, it never rejects either. */
export async function askGm(
  campaignId: string,
  sessionId: string | null,
  input: string,
  mode: GmMode = 'play',
  /** Owner request 2026-08-18 ("the button switches to a stop
   * button"): when the composer aborts this signal, `askGm` settles
   * immediately with `status: 'stopped'` rather than leaving the
   * caller waiting on the original request. This is a CLIENT-SIDE
   * short-circuit only — this supabase-js version's invoke options
   * have no documented `signal` passthrough, and guessing at an
   * undocumented one isn't worth risking a real request breaking over
   * — so the in-flight call to the edge function keeps running
   * server-side and, if it completes, its result is simply never read.
   * Same tolerance `useGmJournalHandlers.ts`'s own doc comment already
   * accepts for a failed journal write after a successful reply: the
   * GM may still answer after a stop, the player just won't see it
   * until the next reload, which beats leaving the button stuck. */
  signal?: AbortSignal,
): Promise<GmTurnResult> {
  try {
    const racers: Promise<unknown>[] = [
      supabase.functions.invoke('gm_turn', {
        body: { campaignId, sessionId, input, mode },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('The GM did not respond.')), CLIENT_TIMEOUT_MS),
      ),
    ]
    if (signal) {
      racers.push(
        new Promise<typeof STOPPED>((resolve) => {
          if (signal.aborted) {
            resolve(STOPPED)
            return
          }
          signal.addEventListener('abort', () => resolve(STOPPED), { once: true })
        }),
      )
    }

    // `any` past this point, matching the permissive `as` casts the
    // rest of this function already uses on the invoke result below —
    // the race's branches are heterogeneous (the SDK's response shape,
    // a never-resolving timeout, and the STOPPED sentinel), and there's
    // no single real type all three share worth fighting for here.
    const result: any = await Promise.race(racers)

    if (result === STOPPED) {
      return { status: 'stopped', message: 'Stopped.', requestCount: 0 }
    }

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
      loggedByTool: data.loggedByTool,
    }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not reach the GM.',
      requestCount: 0,
    }
  }
}

/** Read-aloud (mode `speak`): asks the edge function to synthesize
 * `text` through the provider's TTS and returns base64 WAV. Costs one
 * request from the same daily budget as GM turns. Never rejects, same
 * contract as `askGm` — callers switch on `status`, and any non-`ok`
 * result means "use the browser voice instead" (see lib/speech.ts),
 * never a broken button. */
export async function askGmSpeak(
  campaignId: string,
  text: string,
): Promise<{ status: GmTurnStatus; audio: string | null; message: string }> {
  try {
    const result = await Promise.race([
      supabase.functions.invoke('gm_turn', {
        body: { campaignId, input: text, mode: 'speak' },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TTS timed out.')), CLIENT_TIMEOUT_MS),
      ),
    ])
    if (result.error) return { status: 'error', audio: null, message: result.error.message ?? '' }
    const data = result.data as { status?: GmTurnStatus; audio?: string; message?: string } | null
    if (data?.status !== 'ok' || !data.audio) {
      return { status: data?.status ?? 'error', audio: null, message: data?.message ?? '' }
    }
    return { status: 'ok', audio: data.audio, message: '' }
  } catch (err) {
    return {
      status: 'error',
      audio: null,
      message: err instanceof Error ? err.message : 'TTS failed.',
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

export interface SystemPack {
  /** The table's real key alongside `system` (2026-08-14 fix: an
   * earlier draft of this type invented an `id`/`slug` pair that don't
   * exist on `system_packs` at all -- confirmed against
   * `database.types.ts`'s real generated Row type after the first
   * deploy 400'd. `section` is what's actually there, e.g. 'persona',
   * 'house_rules', 'quick_reference', 'encounter_reference'.) */
  section: string
  title: string | null
  body: string
  sort_order: number
}

/** The GM reference viewer's source data (BUILD_PLAN.md item 15 slice 3)
 * -- `system_packs` already exists and is already load-bearing: it's
 * what `gm_turn/prompt.ts` assembles into the live AI GM's system
 * prompt every turn (see that file's own header comment), so this
 * isn't new content, just a new read surface onto content the app
 * already depends on. Read directly, same "ordinary select, no reason
 * to spend an edge-function invocation" precedent as `listRulesChat`
 * above -- `system_packs_select_authenticated`'s RLS policy is `true`
 * (any authenticated user, not campaign- or owner-scoped), already
 * exercised this way by `lib/rules/index.ts` for character-creation
 * content.
 *
 * `system` is the campaign's `system` column ('shadowdark' today), not
 * a campaign id -- packs aren't per-campaign, they're per ruleset. */
export async function listSystemPacks(system: string): Promise<SystemPack[]> {
  const { data, error } = await supabase
    .from('system_packs')
    .select('section, title, body, sort_order')
    .eq('system', system)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as SystemPack[]
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

/** Mirrors `gm_turn/index.ts`'s own `lastPacificMidnight` — the daily
 * budget resets at Pacific midnight, and `gm_budget_since_by_mode`
 * (like `gm_budget_since` before it) takes that boundary as a plain
 * timestamp rather than computing it server-side, so any direct caller
 * needs this too. Ported rather than shared, since the edge function
 * and this client build don't share a module today. */
function lastPacificMidnight(now = new Date()): Date {
  const tz = 'America/Los_Angeles'
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(now)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  const offset = asUTC - now.getTime()
  const local = new Date(now.getTime() + offset)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offset)
}

export interface GmBudgetByMode {
  /** Play + rules turns today — everything that isn't a voice read. */
  textUsed: number
  /** Read-aloud (`speak` mode) requests today. */
  voiceUsed: number
}

/** Splits today's campaign-wide spend by mode (2026-08-10, migration
 * `gm_budget_by_mode`) — the same shared pool `getGmBudget` already
 * reads (see that function's own doc comment: one ceiling, not two),
 * just broken down by what actually spent it. Built for the header's
 * two budget bars, one per AI, per owner feedback to "track them truly
 * separately": this is the honest version of that request — the
 * CEILING stays the one real shared number, only the USED side is
 * split by mode, so the UI never implies a separate quota that doesn't
 * exist server-side.
 *
 * Called directly via `supabase.rpc` rather than routed through the
 * edge function like `getGmBudget` is: the ceiling constant is the one
 * thing that has to live server-side, and this query doesn't need it —
 * it just sums `gm_turns` rows the caller can already read under RLS.
 * Routing it through the function anyway would cost an extra hop for
 * nothing.
 *
 * Returns null on any failure, same honest-hide contract as
 * `getGmBudget` — treat null as "nothing to show yet," never as "zero
 * used." */
export async function getGmBudgetByMode(campaignId: string): Promise<GmBudgetByMode | null> {
  try {
    const { data, error } = await supabase.rpc('gm_budget_since_by_mode', {
      p_campaign_id: campaignId,
      p_since: lastPacificMidnight().toISOString(),
    })
    if (error) return null
    const row = (Array.isArray(data) ? data[0] : data) as
      | { campaign_used_text?: number; campaign_used_voice?: number }
      | null
    if (!row) return null
    return {
      textUsed: Number(row.campaign_used_text ?? 0),
      voiceUsed: Number(row.campaign_used_voice ?? 0),
    }
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
