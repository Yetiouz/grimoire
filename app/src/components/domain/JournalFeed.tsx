import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { LogEntryRow } from '../ui/LogEntryRow'
import type { LogEntryKind } from '../ui/LogEntryRow'
import { AiVoiceToggle } from './AiVoiceToggle'
import { CheckCard } from './CheckCard'
import { SceneDivider } from '../ui/SceneDivider'
import { EmptyState } from '../ui/EmptyState'
import type { CampaignSession } from '../../lib/campaigns'
import type { FeedItem } from '../../lib/feed'
import type { GmCheck, ResolveSource } from '../../lib/checks'

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
  /** AI-voice on/off pill (2026-08-10) — both omitted together when the
   * voice tier doesn't exist in this build (`VITE_GM_TTS` off), same
   * "omit for read-only/unavailable" convention `onSaveAsNote` and
   * `onResolveCheck` already follow here. When given, every narration
   * row gets the SAME pill state and the SAME toggle handler — this is
   * one global, per-device preference (`useAiVoicePreference`, owned by
   * `JournalScreen`), not a per-row choice, so there is deliberately no
   * per-item plumbing the way `onSaveAsNote` has (that callback needs
   * to know WHICH item was clicked; this one doesn't take an item at
   * all). `JournalFeed` builds the actual `AiVoiceToggle` node itself
   * (unlike `onSaveAsNote`, which the host layout builds) since every
   * row's copy is identical — no reason to ask the host to build the
   * same node repeatedly. */
  aiVoiceOn?: boolean
  onToggleAiVoice?: () => void
  /** Slice 17: forwarded straight to whichever `CheckCard` the player
   * acts on. Omit for a read-only feed (same convention as
   * `onSaveAsNote`) — every check then renders with no live controls. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  /** The one check currently mid-resolve, if any — see `CheckCard`'s own
   * `resolving` prop. */
  resolvingCheckId?: string | null
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
  aiVoiceOn,
  onToggleAiVoice,
  onResolveCheck,
  resolvingCheckId,
  className,
}: JournalFeedProps) {
  const visible = filter ? items.filter(filter) : items
  const bottomRef = useRef<HTMLDivElement>(null)

  // Built once per render, not once per row — every narration row gets
  // the exact same node (same global preference, same handler; see the
  // props doc comment above). `LogEntryRow` itself still only renders
  // it for `kind === 'narration'` rows (via its own `canSpeak` gate),
  // so handing it to every row here is harmless, not wasteful — no
  // per-item branching needed on this side either.
  const voiceToggle =
    aiVoiceOn !== undefined && onToggleAiVoice ? <AiVoiceToggle on={aiVoiceOn} onToggle={onToggleAiVoice} /> : undefined

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
                  voiceToggle={voiceToggle}
                />
              )}
            </Fragment>
          )
        })}
      </div>
      <div ref={bottomRef} aria-hidden="true" />
      {composer}
    </div>
  )
}
