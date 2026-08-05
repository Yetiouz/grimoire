import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { text } from '../../lib/typography'
import { JournalFeed } from '../../components/domain/JournalFeed'
import { JournalComposer } from '../../components/domain/JournalComposer'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'
import { listJournalEntries, listSessions, logJournalEntry, startSession } from '../../lib/campaigns'
import type { Campaign, CampaignSession, JournalEntry } from '../../lib/campaigns'

interface JournalScreenProps {
  campaign: Campaign
  authorName: string
  onBack: () => void
}

/** Placeholder for the signed-in player's own entries until a real
 * character model exists — SPEC's "one PC color everywhere" rule
 * assumes a character record this slice doesn't build (out of scope:
 * "the stat strip needs the character model — next slice"). Matches
 * the app's one accent color and the mockup's own Bjorn example.
 * Flagged here, not hidden: a character-model slice should replace
 * this with the real per-character color. */
const PLAYER_COLOR = '#9b5cff'

/** Screen 2 of Journal v1 (SPEC): the journal, built around the
 * reusable JournalFeed. Page chrome (campaign header, "Start session")
 * lives here, not in the component — JournalFeed itself has no idea
 * it's on the journal screen. */
export function JournalScreen({ campaign, authorName, onBack }: JournalScreenProps) {
  const [sessions, setSessions] = useState<CampaignSession[] | null>(null)
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)

  async function load() {
    setError(null)
    try {
      const [sessionRows, entryRows] = await Promise.all([listSessions(campaign.id), listJournalEntries(campaign.id)])
      setSessions(sessionRows)
      setEntries(entryRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading the journal.')
    }
  }

  useEffect(() => {
    void load()
  }, [campaign.id])

  const openSession = sessions?.find((session) => session.ended_at === null) ?? null

  async function handleStartSession() {
    setStartingSession(true)
    try {
      const session = await startSession(campaign.id)
      // Echo locally rather than refetch — start_session auto-closes any
      // prior open session server-side, but that prior row is already
      // correct in state (its own ended_at just isn't reflected here
      // until the next load()); only the new open session is new.
      setSessions((prev) => [...(prev ?? []), session])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the session.')
    } finally {
      setStartingSession(false)
    }
  }

  async function handleLog(kind: LogEntryKind, body: string) {
    if (!openSession) return
    const entry = await logJournalEntry({
      campaignId: campaign.id,
      sessionId: openSession.id,
      kind,
      body,
      actorName: kind === 'narration' ? 'GM' : authorName,
      actorColor: kind === 'narration' ? undefined : PLAYER_COLOR,
    })
    // Echo own actions locally instead of refetching — the RPC already
    // returns the row exactly as stored.
    setEntries((prev) => [...(prev ?? []), entry])
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className={text.label}>
            ← Campaigns
          </button>
          <h1 className={text.h1}>{campaign.name}</h1>
        </div>
        <Button variant="ghost" onClick={() => void handleStartSession()} disabled={startingSession}>
          {openSession ? 'Start next session' : 'Start session'}
        </Button>
      </div>

      {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}

      {(sessions === null || entries === null) && !error && (
        <SkeletonGroup label="Loading journal" className="gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </SkeletonGroup>
      )}

      {sessions !== null && entries !== null && (
        <JournalFeed
          entries={entries}
          sessions={sessions}
          composer={
            <JournalComposer
              onLog={(kind, body) => handleLog(kind, body)}
              sessionOpen={Boolean(openSession)}
              className="mt-4"
            />
          }
        />
      )}
    </div>
  )
}
