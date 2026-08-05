import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { LogEntryRow } from '../ui/LogEntryRow'
import type { LogEntryKind } from '../ui/LogEntryRow'
import { SceneDivider } from '../ui/SceneDivider'
import { EmptyState } from '../ui/EmptyState'
import type { CampaignSession, JournalEntry } from '../../lib/campaigns'

interface JournalFeedProps {
  entries: JournalEntry[]
  sessions: CampaignSession[]
  /** Lets the host screen scope which entries render (e.g. a future
   * GM-only view) without JournalFeed drawing any filter UI itself —
   * the component stays filter-driven, not filter-owning. Omit to show
   * every entry passed in. */
  filter?: (entry: JournalEntry) => boolean
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
export function JournalFeed({ entries, sessions, filter, composer, className }: JournalFeedProps) {
  const visible = filter ? entries.filter(filter) : entries
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
  let lastSessionId: string | null = null

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        {visible.map((entry) => {
          const session = sessionById.get(entry.session_id)
          const showDivider = Boolean(session) && entry.session_id !== lastSessionId
          lastSessionId = entry.session_id
          return (
            <Fragment key={entry.id}>
              {showDivider && session && <SceneDivider className="my-3">{sessionLabel(session)}</SceneDivider>}
              <LogEntryRow
                senderName={entry.actor_name}
                senderColor={entry.actor_color ?? FALLBACK_COLOR}
                message={entry.body}
                timestamp={new Date(entry.created_at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                kind={entry.kind as LogEntryKind}
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
