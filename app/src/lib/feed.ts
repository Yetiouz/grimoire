import type { CampaignSession, JournalEntry } from './campaigns'
import type { GmChatMessage } from './gm'
import type { LogEntryKind } from '../components/ui/LogEntryRow'

/** Fixed color for every rules-chat row in the unified feed — both the
 * question and the answer, not just the reply. BOB_queue task 1: "Rules
 * exchanges render in orange." An exchange should read as one
 * out-of-character digression at a glance in a feed full of other
 * colors, which is what coloring both lines the same does; `RulesChat`'s
 * own transcript overlay colors only the answer and leaves the question
 * neutral — a deliberate difference for that surface, not something
 * this file follows, per the owner's call. */
const RULES_COLOR = '#ff8a3d'

/** Render-ready row for `JournalFeed` — already resolved to "what name,
 * what color, what body" regardless of whether it came from
 * `journal_entries` or `gm_chat`. `JournalFeed` stays a dumb renderer
 * over this shape; every "what does this kind of item look like"
 * decision lives here instead, next to the merge that produces it. */
export interface FeedItem {
  id: string
  created_at: string
  session_id: string | null
  kind: LogEntryKind
  senderName: string
  /** Undefined means "let LogEntryRow's own FALLBACK_COLOR apply" —
   * same as a journal entry with no `actor_color` today. Always set for
   * rules items. */
  senderColor?: string
  body: string
}

/**
 * `gm_chat` (migration 0011) carries no `session_id` — only
 * `id/campaign_id/user_id/role/body/created_at`. `gm_turns` has one,
 * but there's no FK between the two tables to join through, so a rules
 * message's session has to be inferred from the sessions list already
 * loaded for the screen: whichever session's `[started_at, ended_at ??
 * now)` window contains the message's timestamp, or the closest
 * session by start time when it falls outside every window (a rules
 * question asked between sessions, or before the first one ever
 * started). Returns null only when there are no sessions at all yet.
 */
function inferSessionId(createdAt: string, sessions: CampaignSession[]): string | null {
  if (sessions.length === 0) return null
  const ts = new Date(createdAt).getTime()

  for (const session of sessions) {
    const start = new Date(session.started_at).getTime()
    const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
    if (ts >= start && ts <= end) return session.id
  }

  let closest = sessions[0]
  let closestDelta = Math.abs(ts - new Date(closest.started_at).getTime())
  for (const session of sessions) {
    const delta = Math.abs(ts - new Date(session.started_at).getTime())
    if (delta < closestDelta) {
      closest = session
      closestDelta = delta
    }
  }
  return closest.id
}

/**
 * BOB_queue task 1: one continuous stream — GM narration (already a
 * real `journal_entries` row, `kind: 'narration'`) alongside `gm_chat`'s
 * rules exchanges, merged by `created_at`. Rules rows are *displayed*
 * here and never written back to `journal_entries` — this function only
 * reads two arrays the caller already fetched and produces a third; it
 * has no Supabase access of its own.
 *
 * Each `gm_chat` row is already one message (one row per turn of the
 * exchange, per its own schema), so this is a straight 1:1 map, not a
 * question+answer pairing step — `direction` just reads `role` to pick
 * the author-line convention ("`<name> -> Rules`" for the question,
 * "Rules" for the answer).
 */
export function buildFeed(
  entries: JournalEntry[],
  rulesMessages: GmChatMessage[],
  sessions: CampaignSession[],
  authorName: string,
): FeedItem[] {
  const journalItems: FeedItem[] = entries.map((entry) => ({
    id: entry.id,
    created_at: entry.created_at,
    session_id: entry.session_id,
    kind: entry.kind as LogEntryKind,
    senderName: entry.actor_name,
    senderColor: entry.actor_color ?? undefined,
    body: entry.body,
  }))

  const rulesItems: FeedItem[] = rulesMessages.map((message) => ({
    id: `rules-${message.id}`,
    created_at: message.created_at,
    session_id: inferSessionId(message.created_at, sessions),
    kind: 'rules',
    senderName: message.role === 'user' ? `${authorName} → Rules` : 'Rules',
    senderColor: RULES_COLOR,
    body: message.body,
  }))

  return [...journalItems, ...rulesItems].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}
