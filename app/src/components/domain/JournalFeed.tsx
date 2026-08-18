import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { LogEntryRow } from '../ui/LogEntryRow'
import type { LogEntryKind } from '../ui/LogEntryRow'
import { CheckCard } from './CheckCard'
import { GmTurnIndicator } from './GmTurnIndicator'
import { SceneDivider } from '../ui/SceneDivider'
import { EmptyState } from '../ui/EmptyState'
import type { CampaignSession } from '../../lib/campaigns'
import type { FeedItem } from '../../lib/feed'
import type { GmCheck, ResolveSource } from '../../lib/checks'
import type { PendingGmTurn } from '../../lib/gm'

interface JournalFeedProps {
  /** BOB_queue task 1: render-ready rows, already merged from
   * journal_entries and gm_chat (and, Slice 17, gm_checks) and sorted by
   * created_at (see lib/feed.ts's buildFeed()) — JournalFeed itself has
   * no idea some of these came from a different table, which is what
   * keeps it filter-driven and source-agnostic rather than growing
   * gm_chat/gm_checks awareness of its own. Was `entries: JournalEntry[]`
   * before BOB_queue task 1; every call site now passes the merged array
   * instead. */
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
  /** "Save as note" quick action (2026-08-09): passed straight through
   * to each `LogEntryRow` as a per-item callback — `JournalFeed` still
   * creates nothing itself, it just hands the host layout back the item
   * that was clicked so it can seed its own composer. Omit to render no
   * button on any row (the mockup/review-only call sites that pass no
   * composer at all have nowhere to send a saved note anyway). Withheld
   * for `'note'` items below regardless of whether this is set — saving
   * a note from a note is a no-op the button shouldn't even offer. */
  onSaveAsNote?: (item: FeedItem) => void
  /** Global voice preference (UI review slice A, 2026-08-16) — the old
   * `aiVoiceOn`/`onToggleAiVoice` pair is gone with the per-row pill it
   * fed: the toggle now lives once, by the composer (`AiVoiceToggle`,
   * rendered by `JournalComposer`), and the feed only receives the
   * resulting on/off to forward to each row. `false` removes read-aloud
   * buttons from every narration row (`LogEntryRow`'s `voiceEnabled`
   * gate); omit for the old always-available behavior — read-only call
   * sites that never wired voice keep their speak buttons. */
  voiceEnabled?: boolean
  /** Slice 17: forwarded straight to whichever `CheckCard` the player
   * acts on. Omit for a read-only feed (same convention as
   * `onSaveAsNote`) — every check then renders with no live controls. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  /** The one check currently mid-resolve, if any — see `CheckCard`'s own
   * `resolving` prop. */
  resolvingCheckId?: string | null
  /** The composer's in-flight/settled AI turn (2026-08-18), lifted out
   * of `JournalComposer` so it can render here — right where the next
   * reply will land — instead of next to the input. See
   * `PendingGmTurn`'s own doc comment for the full "why here" reasoning
   * and `GmTurnIndicator` for what actually renders. Omit (or leave
   * null) for every read-only/non-AI feed — same optional-callback
   * convention `onResolveCheck` already follows. */
  pendingTurn?: PendingGmTurn | null
  /** Clears `pendingTurn` — wired to the settled row's dismiss button
   * (via `GmTurnIndicator` -> `GmReply`'s existing `onDismiss`). Only
   * meaningful once `pendingTurn` is set; unused while it's null. */
  onDismissPendingTurn?: () => void
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
export function JournalFeed({
  items,
  sessions,
  filter,
  composer,
  onSaveAsNote,
  voiceEnabled,
  onResolveCheck,
  resolvingCheckId,
  pendingTurn,
  onDismissPendingTurn,
  className,
}: JournalFeedProps) {
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
  // Also re-runs when `pendingTurn` changes (a new Ask starting, or one
  // settling) — 2026-08-18, so the thinking/settled row this effect now
  // shares the feed with is scrolled into view the same way a new entry
  // already was, rather than landing off-screen below the fold.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length, pendingTurn])

  if (visible.length === 0 && !pendingTurn) {
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
              {item.kind === 'check' && item.check ? (
                <CheckCard
                  check={item.check}
                  resolving={resolvingCheckId === item.check.id}
                  onResolve={onResolveCheck}
                />
              ) : (
                <LogEntryRow
                  senderName={item.senderName}
                  senderColor={item.senderColor ?? FALLBACK_COLOR}
                  message={item.body}
                  timestamp={new Date(item.created_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  kind={item.kind as LogEntryKind}
                  onSaveAsNote={
                    onSaveAsNote && item.kind !== 'note' ? () => onSaveAsNote(item) : undefined
                  }
                  voiceEnabled={voiceEnabled}
                />
              )}
            </Fragment>
          )
        })}
        {/* Right where the next reply lands (2026-08-18) — see
          * `PendingGmTurn`'s own doc comment for why this moved here
          * from the composer. Last row in the same gap-2 flex column as
          * every entry above it, not a separate section, so it reads as
          * part of the conversation rather than UI chrome bolted on. */}
        {pendingTurn && (
          <GmTurnIndicator pending={pendingTurn} onDismiss={() => onDismissPendingTurn?.()} />
        )}
      </div>
      <div ref={bottomRef} aria-hidden="true" />
      {composer}
    </div>
  )
}
