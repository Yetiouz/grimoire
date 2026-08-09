import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Markdown } from '../ui/Markdown'
import { listRulesChat } from '../../lib/gm'
import type { GmChatMessage } from '../../lib/gm'

interface RulesChatProps {
  open: boolean
  campaignId: string
  onClose: () => void
}

/** The rules-chat transcript, opened from the Rules tile in Tools.
 *
 * Read-only on purpose. Questions are asked from the composer, where
 * your hands already are mid-scene; this is where you come to look
 * something up again afterwards. Splitting "ask" from "read back" that
 * way keeps a second input box out of the layout, and means the Rules
 * tile finally has a destination instead of being a disabled stub.
 *
 * Nothing here is campaign fiction — it lives in `gm_chat`, not
 * `journal_entries`, and deliberately never appears in the feed. */
export function RulesChat({ open, campaignId, onClose }: RulesChatProps) {
  const [messages, setMessages] = useState<GmChatMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refetch on every open rather than caching: the composer writes to
  // this transcript behind our back, so a cached copy goes stale the
  // moment the player asks anything.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(null)
    setError(null)
    listRulesChat(campaignId)
      .then((rows) => { if (!cancelled) setMessages(rows) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the rules chat.')
      })
    return () => { cancelled = true }
  }, [open, campaignId])

  return (
    <Overlay
      open={open}
      onClose={onClose}
      header={
        <div>
          <div className={text.body}>Rules</div>
          <div className={cx(text.label, 'mt-1')}>
            Out of character · never written to the journal
          </div>
        </div>
      }
    >
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {messages === null && !error && (
        <SkeletonGroup label="Loading rules chat" className="gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </SkeletonGroup>
      )}

      {messages !== null && messages.length === 0 && (
        <EmptyState
          icon="rules"
          title="No rules questions yet"
          description="Switch the composer to Ask Rules to look something up. Answers land here, not in the campaign journal."
        />
      )}

      {messages !== null && messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                'rounded-card border px-3 py-2.5',
                m.role === 'user'
                  ? 'border-line-soft bg-panel2'
                  : 'border-orange/25 bg-orange/[0.06]',
              )}
            >
              <div className={cx(text.label, m.role === 'assistant' && 'text-orange')}>
                {m.role === 'user' ? 'You' : 'Rules'}
                {' · '}
                {new Date(m.created_at).toLocaleString()}
              </div>
              {/* BOB_queue task 2: rendered through the markdown subset
                * renderer rather than raw `whitespace-pre-wrap` text —
                * the rules assistant is explicitly asked to structure
                * its answers (page citations bolded, lists of Modes of
                * Play), so this is the surface where that structure
                * should actually show up. Applied to both roles rather
                * than assistant-only: a typed question with no markdown
                * syntax in it renders identically either way, and this
                * keeps the two message shapes on one code path. */}
              <Markdown text={m.body} variant="body" className="mt-1" />
            </div>
          ))}
        </div>
      )}
    </Overlay>
  )
}
