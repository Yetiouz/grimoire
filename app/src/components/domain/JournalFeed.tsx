import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { LogEntryRow } from '../ui/LogEntryRow'
import { SceneDivider } from '../ui/SceneDivider'
import { EmptyState } from '../ui/EmptyState'
import type { CampaignSession } from '../../lib/campaigns'
import type { FeedItem } from '../../lib/feed'

interface JournalFeedProps {
  /** BOB_queue task 1: render-ready rows, already merged from
   * journal_entries and gm_chat and sorted by created_at (see
   * lib/feed.ts's buildFeed()) — JournalFeed itself has no idea some of
   * these came from a different table, which is what keeps it filter-
   * driven and source-agnostic rather than growing gm_chat awareness of
   * its own. Was `entries: JournalEntry[]` before this task; every call
   * site now passes the merged array instead. */
  items: FeedItem[]
  sessions: CampaignSession[]
  /** Lets the host screen scope which items render (JournalFilterBar's
   * mute chips, or a future GM-only view) without JournalFeed drawing
   * any filter UI itself — the component stays filter-driven, not
   * filter-owning. Omit to show every item passed in. */
  filter?: (item: FeedItem) => boolean
  /** Rendered below the feed. A ReactNode, not a fixed slot for
   * JournalComposer specifically — the component boundary is "entries +
   * session dividers + optional composer," not "entries + THE
   * composer": the player table, GM dashboard, and session review all
   * instantiate this without one at all. */
  composer?: ReactNode
  className?: string
}

const FALLBACK_COLOR = '#66666f'

function sessionLabel(session: CampaignSession): string {
  if (session.title) return `Session ${session.number} — ${session.title}`
  const date = new Date(session.started_at).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return `Session ${session.number} — ${date}`
}

/** The reusable scene log: entries grouped under session dividers,
 * newest at the bottom. Per SPEC's component boundary, this must render
 * identically wherever it's placed — journal screen today, later the
 * player table, GM dashboard, and session review (twice on one screen
 * once party chat arrives). Page chrome like the campaign header stays
 * with the host screen, not here. */
export function JournalFeed({ items, sessions, filter, composer, className }: JournalFeedProps) {
  const visible = filter ? items.filter(filter) : items
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the newest entry, just above the composer (the
  // journal screen pins its composer to the viewport bottom — see
  // JournalScreen). Runs on mount too, not just on new entries, so
  // opening a journal with a long history lands on the latest entry
  // instead of the first. Declared before the empty-state early return
  // below so the hook still fires on every render (Rules of Hooks) even
  // though `bottomRef` has nothing to attach to in that branch. Rides
  // index.css's global `scroll-behavior: smooth` rather than overriding
  // it per-call, so mount and live updates animate the same way.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length])

  if (visible.length === 0) {
    return (
      <div className={className}>
        <EmptyState icon="journal" title="No entries yet" description="The pages await." />
        {composer}
      </div>
    )
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session] as const))

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        {visible.map((item, index) => {
          const session = item.session_id ? sessionById.get(item.session_id) : undefined
          // Divider shows whenever this item starts a new session run —
          // derived from the previous array item rather than an outer
          // `let` mutated during the map (the prior shape), which
          // react-hooks/immutability now flags as a render-time mutation
          // even though it was harmless here (recomputed fresh every
          // render). Reading `visible[index - 1]` instead keeps the same
          // result with no mutable state at all. Works the same for a
          // rules item as a journal entry — its session_id is inferred
          // (lib/feed.ts) rather than stored, but by the time it reaches
          // here it's just a session_id like any other.
          const previousSessionId = index > 0 ? visible[index - 1].session_id : null
          const showDivider = Boolean(session) && item.session_id !== previousSessionId
          return (
            <Fragment key={item.id}>
              {showDivider && session && <SceneDivider className="my-3">{sessionLabel(session)}</SceneDivider>}
              <LogEntryRow
                senderName={item.senderName}
                senderColor={item.senderColor ?? FALLBACK_COLOR}
                message={item.body}
                timestamp={new Date(item.created_at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                kind={item.kind}
              />
            </Fragment>
          )
        })}
      </div>
      <div ref={bottomRef} aria-hidden="true" />
      {composer}
    </div>
  )
}
