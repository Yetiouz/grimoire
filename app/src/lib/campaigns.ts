import { supabase } from './supabase'
import type { Json, Tables } from './database.types'

export type Campaign = Tables<'campaigns'>
export type CampaignSession = Tables<'sessions'>
export type JournalEntry = Tables<'journal_entries'>
export type CampaignMember = Tables<'campaign_members'>

/** `campaigns.gm_mode`'s three values (migration 0019's own CHECK
 * constraint) — narrowed here from the raw `string` column type
 * `database.types.ts` generates, so both the "New Campaign" picker and
 * the settings toggle (owner request, 2026-08-15: "i want one when
 * starting a campaign. and a toggle.") share one real type instead of
 * each hand-rolling their own union. */
export type GmMode = 'solo' | 'ai' | 'human'

/** Single source of truth for every gm_mode picker's copy — label plus
 * a one-line description of what picking it means at the table. Order
 * is deliberate: `solo` first since it's the table default and the
 * lowest-commitment choice, `ai` last since a build without
 * `VITE_GM_ENABLED` filters it out entirely (see `GmModeSelector`). */
export const GM_MODE_OPTIONS: { value: GmMode; label: string; description: string }[] = [
  { value: 'solo', label: 'Solo', description: 'Just you — no GM narration.' },
  { value: 'human', label: 'Human GM', description: 'Someone at the table runs it live.' },
  { value: 'ai', label: 'AI GM', description: "Grimoire's AI narrates and adjudicates." },
]

/** `campaigns.system` — the multi-system seam `lib/rules/index.ts`'s own
 * doc comment describes, keyed the same way. Narrowed here from the raw
 * `string` column type for the same reason `GmMode` is: one real union
 * the "New Campaign" picker and anything else that reads `system` can
 * share, instead of each hand-rolling its own. Not literally every value
 * `lib/rules` could theoretically key on — just the ones this app
 * actually knows about, i.e. has a `SYSTEM_OPTIONS` entry for. */
export type System = 'shadowdark' | 'cyborg'

/** Single source of truth for the system picker's copy — same shape as
 * `GM_MODE_OPTIONS` right above. `hasWizard: false` on `cyborg` isn't a
 * restriction on picking it (an owner can start a CY_BORG campaign
 * today; `CharacterBuilder`'s own `hasRulesModule` gate is what actually
 * decides whether guided creation exists yet) — it's just what powers
 * the picker's own "wizard coming soon" caption so the choice is honest
 * up front instead of only discovered after opening New Character. */
export const SYSTEM_OPTIONS: { value: System; label: string; description: string; hasWizard: boolean }[] = [
  { value: 'shadowdark', label: 'Shadowdark', description: 'Guided character creation, full wizard.', hasWizard: true },
  { value: 'cyborg', label: 'CY_BORG', description: 'Character creation wizard coming soon — roll with the GM in chat for now.', hasWizard: false },
]

/** A campaign plus its most recent journal entry's timestamp, for the
 * campaign list's "name + last-entry time" card (SPEC's Journal v1
 * screen 1). `lastEntryAt` is null for a campaign with no entries yet. */
export interface CampaignWithLastEntry extends Campaign {
  lastEntryAt: string | null
}

/** Campaigns the signed-in user is a member of. RLS already scopes this
 * to membership (`campaigns_select_member`) — no explicit
 * `.eq('owner', ...)` here, correctly covers both owned campaigns and,
 * as of migration 0023's join-by-code flow, campaigns joined as a
 * plain player too. */
export async function listCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** listCampaigns() plus each campaign's latest journal_entries.created_at,
 * fetched with one extra query rather than N+1 — v1's small,
 * single-owner campaign counts make a per-campaign round trip wasteful
 * for no real benefit. */
export async function listCampaignsWithLastEntry(): Promise<CampaignWithLastEntry[]> {
  const campaigns = await listCampaigns()
  if (campaigns.length === 0) return []

  const { data, error } = await supabase
    .from('journal_entries')
    .select('campaign_id, created_at')
    .in(
      'campaign_id',
      campaigns.map((campaign) => campaign.id),
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  const lastEntryByCampaign = new Map<string, string>()
  for (const row of data) {
    if (!lastEntryByCampaign.has(row.campaign_id)) {
      lastEntryByCampaign.set(row.campaign_id, row.created_at)
    }
  }

  return campaigns.map((campaign) => ({
    ...campaign,
    lastEntryAt: lastEntryByCampaign.get(campaign.id) ?? null,
  }))
}

export async function listSessions(campaignId: string): Promise<CampaignSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('number', { ascending: true })
  if (error) throw error
  return data
}

export async function listJournalEntries(campaignId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Wraps the `create_campaign` command. `gmMode` defaults to `'solo'` —
 * migration 0033 made it an optional second RPC parameter (owner
 * request, 2026-08-15) precisely so this call keeps working with just a
 * name for any caller that doesn't care. `system` defaults to
 * `'shadowdark'` the same way, added in migration 0036 once the "New
 * Campaign" modal grew a `SystemSelector` to go with its existing
 * `GmModeSelector` — before that it stayed hidden/defaulted server-side
 * with no UI passing it at all. */
export async function createCampaign(name: string, gmMode: GmMode = 'solo', system: System = 'shadowdark'): Promise<Campaign> {
  const { data, error } = await supabase.rpc('create_campaign', { p_name: name, p_gm_mode: gmMode, p_system: system })
  if (error) throw error
  return data
}

/** Wraps `update_campaign_gm_mode` (migration 0033) — owner-only
 * server-side (the RPC checks `campaigns.owner = auth.uid()` itself and
 * raises if it doesn't match), same "component doesn't re-check, the
 * RPC is the real boundary" convention `ensureCampaignJoinCode` below
 * already follows. Lets an existing campaign's mode change after
 * creation — the settings-toggle half of the owner's 2026-08-15 request. */
export async function updateCampaignGmMode(campaignId: string, gmMode: GmMode): Promise<Campaign> {
  const { data, error } = await supabase.rpc('update_campaign_gm_mode', { p_campaign_id: campaignId, p_gm_mode: gmMode })
  if (error) throw error
  return data
}

/** The signed-in user's own `campaign_members` row for this campaign,
 * or null if they somehow have none (shouldn't happen for anyone who
 * legitimately reached a screen that calls this — `CampaignList` only
 * ever hands out campaigns RLS already scoped to membership). No
 * `.eq('user_id', ...)` needed: `campaign_members_select_own`'s RLS
 * policy already restricts every read on this table to the caller's
 * own row, so this can't accidentally leak another member's row even
 * without an explicit filter. Added 2026-08-11 alongside the join-by-
 * code flow (migration 0023) — this is the piece that lets the app
 * tell "my character" apart from "a character," see
 * `JournalScreen.tsx`'s own doc comment on `myCharacter`. */
export async function getMyMembership(campaignId: string): Promise<CampaignMember | null> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Wraps `ensure_campaign_join_code` — owner-only server-side, lazily
 * mints this campaign's one persistent invite code on first call and
 * just returns it on every call after (idempotent, so opening the
 * Invite dialog repeatedly never rotates a code already handed out).
 * See migration 0023's header comment for why this is one reusable
 * code per campaign rather than a per-person invite. */
export async function ensureCampaignJoinCode(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_campaign_join_code', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

/** Wraps `join_campaign_by_code` — the other half of
 * `ensureCampaignJoinCode`. Any authenticated user can call this with
 * any campaign's code; the RPC adds them as `role: 'player'` (or is a
 * harmless no-op if they're already a member) and returns the campaign
 * row, so the caller can navigate straight into it the same way
 * `createCampaign` already does. */
export async function joinCampaignByCode(code: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('join_campaign_by_code', { p_code: code })
  if (error) throw error
  return data
}

/** Wraps `start_session`. Auto-closes any currently-open session in this
 * campaign first — database-enforced (a partial unique index), not
 * client logic. No separate "end session" UI in v1, per the approved
 * plan's Amendment 2: starting the next session is how one ends. */
export async function startSession(campaignId: string, title?: string): Promise<CampaignSession> {
  const { data, error } = await supabase.rpc('start_session', { p_campaign_id: campaignId, p_title: title })
  if (error) throw error
  return data
}

/** Wraps `end_session` — closes the currently open session without
 * starting a new one (unlike `startSession`, which auto-closes any
 * open session as a side effect of opening the next one). Added after
 * `startSession`-as-the-only-way-to-end turned out to be a real gap in
 * practice, not just a theoretical one: there was no way to just stop
 * for the night without immediately opening a new, empty next session.
 * Throws if there's no open session — callers should only offer this
 * when one exists.
 *
 * `recapNote` (BUILD_PLAN.md item 7, 2026-08-14, migration
 * `0028_session_recap.sql`) — the optional freeform "next time" note
 * from `EndSessionReview`. Passed straight through; `end_session`
 * itself is what combines it with a server-computed XP/gold/HP/gear
 * roll-up into one `system` journal_entries row, not this wrapper —
 * see that migration's own doc comment for why the aggregation lives
 * there and not here. */
export async function endSession(campaignId: string, recapNote?: string): Promise<CampaignSession> {
  const { data, error } = await supabase.rpc('end_session', { p_campaign_id: campaignId, p_recap_note: recapNote || undefined })
  if (error) throw error
  return data
}

/** Raw `campaign_events` rows since a given timestamp, for
 * `EndSessionReview`'s client-side recap preview (BUILD_PLAN.md item
 * 7, 2026-08-14) — narrowed to the character/clock event kinds that
 * preview actually aggregates, not every kind the ledger tracks (no
 * reason to ship `map_marker_added`/`party_position_updated` rows down
 * to a component that only reads five specific kinds). Deliberately a
 * thin, generic read — `payload`'s shape differs per `kind`, and
 * that's the caller's problem to sort out (see `EndSessionReview`'s
 * own `isRecord`/`asInt` guards), not something this function tries to
 * union-type. RLS (`campaign_events_select_member`) is what actually
 * scopes this to campaigns the caller belongs to; `campaignId` here is
 * just which one to ask about. */
export async function listCampaignEventsSince(
  campaignId: string,
  sinceIso: string,
): Promise<Array<{ kind: string; payload: Json }>> {
  const { data, error } = await supabase
    .from('campaign_events')
    .select('kind, payload')
    .eq('campaign_id', campaignId)
    .gte('created_at', sinceIso)
    .in('kind', [
      'character_xp_changed',
      'character_gold_changed',
      'character_hp_changed',
      'character_gear_added',
      'character_gear_removed',
      'clock_advanced',
    ])
  if (error) throw error
  return data
}

/** Wraps `pause_session` (migration `session_pause_resume`, 2026-08-10) —
 * supersedes `end_session`'s own doc comment, which had recorded "no
 * pause, confirmed directly" as a deliberate decision back when it
 * shipped. Re-confirmed directly with the owner instead of silently
 * reversing that call: `SessionAction.tsx`'s pause button had shipped
 * as a disabled stub since v11 promising "coming with session states,"
 * and that promise is now kept. A paused session stays open (same
 * `ended_at is null`, same session number) — it's still the one
 * `sessions_one_open_per_campaign` tracks — just not accepting new
 * play until `resumeSession` clears it. Throws if there's no open
 * session, or if it's already paused — callers should only offer this
 * when `openSession` exists and isn't already paused. */
export async function pauseSession(campaignId: string): Promise<CampaignSession> {
  const { data, error } = await supabase.rpc('pause_session', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

/** Wraps `resume_session` — the other half of `pauseSession`. Throws if
 * there's no open session, or if it isn't currently paused. */
export async function resumeSession(campaignId: string): Promise<CampaignSession> {
  const { data, error } = await supabase.rpc('resume_session', { p_campaign_id: campaignId })
  if (error) throw error
  return data
}

export async function logJournalEntry(params: {
  campaignId: string
  sessionId: string
  kind: string
  body: string
  actorName: string
  actorColor?: string
}): Promise<JournalEntry> {
  const { data, error } = await supabase.rpc('log_journal_entry', {
    p_campaign_id: params.campaignId,
    p_session_id: params.sessionId,
    p_kind: params.kind,
    p_body: params.body,
    p_actor_name: params.actorName,
    p_actor_color: params.actorColor,
  })
  if (error) throw error
  return data
}

/** Wraps `amend_journal_entry` (Amendment 1) — body-only edits by the
 * original author; the prior body is preserved in the ledger, never
 * lost. Not wired to any UI yet in this slice (the approved mockup
 * doesn't draw an edit affordance) — exposed here so the command is
 * reachable once one lands. */
export async function amendJournalEntry(entryId: string, newBody: string): Promise<JournalEntry> {
  const { data, error } = await supabase.rpc('amend_journal_entry', {
    p_entry_id: entryId,
    p_new_body: newBody,
  })
  if (error) throw error
  return data
}
