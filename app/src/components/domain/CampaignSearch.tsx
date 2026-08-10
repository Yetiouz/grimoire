import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { EmptyState } from '../ui/EmptyState'
import { TextInput } from '../ui/TextInput'
import { LogEntryRow } from '../ui/LogEntryRow'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { FeedItem } from '../../lib/feed'
import type { CampaignSession } from '../../lib/campaigns'

interface CampaignSearchProps {
  open: boolean
  /** The same merged, already-loaded feed `JournalFeed` renders
   * (`useJournalFeed`'s `feedItems`) — this overlay reads it, it never
   * fetches its own copy. The whole campaign's history already lives in
   * memory on this screen (no pagination anywhere in this app yet), so a
   * plain client-side filter is the honest implementation here, not a
   * placeholder for a future search index — see `JournalHeader`'s old
   * doc comment, which this component supersedes ("no search index" is
   * no longer true; there was just never anywhere for a match to go). */
  items: FeedItem[]
  sessions: CampaignSession[]
  onClose: () => void
}

/** Small formatting helper, deliberately not shared with `JournalFeed`'s
 * own (near-identical) `sessionLabel` — both are a few lines of private
 * display logic for two different read-only surfaces, and this one only
 * needs a short form (no full date) since it's inlined into a row's
 * timestamp slot rather than standing alone as a `SceneDivider`. */
function shortSessionLabel(session: CampaignSession | undefined): string {
  if (!session) return 'No session'
  return session.title ? `Session ${session.number} — ${session.title}` : `Session ${session.number}`
}

/**
 * Wired up from the header's "Search the campaign…" pill (desktop) and
 * the mobile Tools grid's Search tile (2026-08-10) — both had been
 * disabled structural stubs since the visual-reconciliation pass ("may
 * be non-functional stubs for now, but the structure ships"). Read-only,
 * same shape as `RulesChat`: a full-screen `Overlay` over the existing
 * feed data rather than a new destination the player has to learn.
 *
 * Every real journal entry, rules exchange, and check is already loaded
 * in memory for this screen (`feedItems`) — there is no separate search
 * index or server round trip, just a case-insensitive, every-word-must-
 * match filter over each item's sender name and body. Checks are
 * excluded from matching (`kind === 'check'` items carry no body text of
 * their own, see `lib/feed.ts`'s `buildFeed`), and results sort newest
 * first — the opposite of the feed's own oldest-first order, which
 * exists to support scroll-to-bottom-on-new-entry; a search result list
 * has no such scroll position to protect, and "what did we just say
 * about this" is the more common reason to search.
 */
export function CampaignSearch({ open, items, sessions, onClose }: CampaignSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Fresh query every time the overlay opens — a stale search term from
  // three sessions ago sitting in the field would be confusing, not
  // convenient. Also focuses the field so a keyboard-first player can
  // start typing immediately, same reasoning as JournalComposer's own
  // seed-focus effect.
  useEffect(() => {
    if (!open) return
    setQuery('')
    inputRef.current?.focus()
  }, [open])

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const sessionById = new Map(sessions.map((session) => [session.id, session] as const))

  const matches =
    tokens.length === 0
      ? []
      : items
          .filter((item) => item.kind !== 'check')
          .filter((item) => {
            const haystack = `${item.senderName} ${item.body}`.toLowerCase()
            return tokens.every((token) => haystack.includes(token))
          })
          .slice()
          .reverse()

  return (
    <Overlay
      open={open}
      onClose={onClose}
      header={
        <div>
          <div className={text.body}>Search</div>
          <div className={cx(text.label, 'mt-1')}>Journal entries and rules exchanges, this campaign</div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          ref={inputRef}
          value={query}
          onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
          placeholder="Search by keyword…"
          aria-label="Search the campaign"
          className="w-full"
        />

        {tokens.length === 0 && (
          <EmptyState
            icon="search"
            title="Search the campaign"
            description="Type a name or a word from a past entry — narration, actions, notes, and rules answers all match."
          />
        )}

        {tokens.length > 0 && matches.length === 0 && (
          <EmptyState icon="search" title="No matches" description="Try a different word, or check your spelling." />
        )}

        {matches.length > 0 && (
          <div className="flex flex-col gap-2">
            {matches.map((item) => (
              <LogEntryRow
                key={item.id}
                senderName={item.senderName}
                senderColor={item.senderColor ?? '#66666f'}
                message={item.body}
                kind={item.kind as LogEntryKind}
                timestamp={`${shortSessionLabel(item.session_id ? sessionById.get(item.session_id) : undefined)} · ${new Date(
                  item.created_at,
                ).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
              />
            ))}
          </div>
        )}
      </div>
    </Overlay>
  )
}
