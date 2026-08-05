import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { text } from '../../lib/typography'
import { JournalFeed } from '../../components/domain/JournalFeed'
import { JournalComposer } from '../../components/domain/JournalComposer'
import { PlayerCard } from '../../components/domain/PlayerCard'
import { CharacterSheet } from '../../components/domain/CharacterSheet'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'
import { listJournalEntries, listSessions, logJournalEntry, startSession } from '../../lib/campaigns'
import type { Campaign, CampaignSession, JournalEntry } from '../../lib/campaigns'
import { listCharacters } from '../../lib/characters'
import type { Character } from '../../lib/characters'

interface JournalScreenProps {
  campaign: Campaign
  authorName: string
  onBack: () => void
}

/** Last-resort fallback for `actorColor` when no character record has
 * loaded yet (e.g. the very first log while `characters` is still
 * null) — not the everyday case anymore. Real per-character color now
 * comes from `characters.color` (migration 0005), closing the gap this
 * constant used to paper over entirely. */
const FALLBACK_PLAYER_COLOR = '#9b5cff'

/** Screen 2 of Journal v1 (SPEC): the journal, built around the
 * reusable JournalFeed. Page chrome (campaign header, "Start session",
 * the party row) lives here, not in the component — JournalFeed itself
 * has no idea it's on the journal screen. */
export function JournalScreen({ campaign, authorName, onBack }: JournalScreenProps) {
  const [sessions, setSessions] = useState<CampaignSession[] | null>(null)
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)
  const [openCharacter, setOpenCharacter] = useState<Character | null>(null)

  async function load() {
    setError(null)
    try {
      const [sessionRows, entryRows, characterRows] = await Promise.all([
        listSessions(campaign.id),
        listJournalEntries(campaign.id),
        listCharacters(campaign.id),
      ])
      setSessions(sessionRows)
      setEntries(entryRows)
      setCharacters(characterRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading the journal.')
    }
  }

  useEffect(() => {
    void load()
  }, [campaign.id])

  // Solo v1 has exactly one in-play PC (Kimbo) — using the single
  // `active` character's color is correct for that case without
  // inventing a real auth-user-to-character lookup (matching
  // `campaign_members.user_id` through to `characters.member_id`) that
  // multi-player campaigns will eventually need. Flagged rather than
  // built, since nothing in this slice's scope requires it yet.
  const activeCharacter = characters?.find((character) => character.status === 'active') ?? null
  const playerColor = activeCharacter?.color ?? FALLBACK_PLAYER_COLOR

  const openSession = sessions?.find((session) => session.ended_at === null) ?? null

  // Header meta line ("Solo · Session N"): "Solo" is a static placeholder
  // — there's no game-mode field yet (party vs. solo vs. AI-GM'd isn't
  // modeled in this slice) — but the session number is real, sourced
  // from `sessions` rather than hardcoded. Prefers the open session; if
  // none is open, falls back to the most recent one (listSessions orders
  // ascending by number, so the last array item is the latest); with no
  // sessions at all yet, says so instead of showing a fabricated number.
  const latestSession = sessions && sessions.length > 0 ? sessions[sessions.length - 1] : null
  const headerSession = openSession ?? latestSession
  const sessionMeta = headerSession ? `Solo · Session ${headerSession.number}` : 'Solo · No sessions yet'

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
      actorColor: kind === 'narration' ? undefined : playerColor,
    })
    // Echo own actions locally instead of refetching — the RPC already
    // returns the row exactly as stored.
    setEntries((prev) => [...(prev ?? []), entry])
  }

  // Header session control: one button, two states, same click handler
  // throughout (Amendment 2 — there's no separate "end session" command,
  // starting the next session is how one ends). "Not started" reads
  // "Start Session"; once a session is open it relabels to "In Session"
  // with a live dot (StatusChip's existing tone-dot vocabulary,
  // `h-2 w-2 rounded-full bg-{tone}`) but stays clickable — clicking it
  // while live starts the next session, same as it always has. The
  // native `title` tooltip spells that out since the relabel alone could
  // otherwise read as a passive status pill rather than still being an
  // action.
  const sessionAction = (
    <Button
      variant="ghost"
      onClick={() => void handleStartSession()}
      disabled={startingSession}
      className="gap-2"
      title={openSession ? 'Starting the next session ends this one' : 'Start a session to begin logging'}
    >
      {openSession && <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />}
      {openSession ? 'In Session' : 'Start Session'}
    </Button>
  )

  return (
    <div className="min-h-screen">
      <PageHeader
        left={
          <button onClick={onBack} className={text.label}>
            ← Campaigns
          </button>
        }
        right={<span className={text.label}>{sessionMeta}</span>}
        title={campaign.name}
        titleAction={sessionAction}
      />

      {/* composer-clearance (index.css): the composer is pinned fixed to
       * the viewport below, outside this container's normal flow, so
       * without reserved bottom space its bar would sit on top of the
       * feed's last few rows instead of below them. */}
      <div className="composer-clearance mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}

        {(sessions === null || entries === null || characters === null) && !error && (
          <SkeletonGroup label="Loading journal" className="gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SkeletonGroup>
        )}

        {/* Party row (BUILD_PLAN.md slice 3): a simple stacked row of
         * PlayerCards above the feed, within this same max-w-2xl column
         * — not the mockup's full left rail, which is later table-view
         * work. Awaiting PCs (Constantine, LaLa) render dimmed rather
         * than filtered out, per PlayerCard's own resolved-mockup
         * behavior. */}
        {characters !== null && characters.length > 0 && (
          <div className="flex flex-col gap-2">
            {characters.map((character) => (
              <PlayerCard key={character.id} character={character} onClick={() => setOpenCharacter(character)} />
            ))}
          </div>
        )}

        {sessions !== null && entries !== null && (
          <JournalFeed
            entries={entries}
            sessions={sessions}
            composer={
              // Fixed to the viewport bottom, per the approved
              // journal-mockup.html (`.composer`): the feed scrolls
              // behind it rather than pushing it down the page. Wrapped
              // here at the call site — not inside JournalComposer
              // itself — so the component stays a plain content block
              // that any future host (a review screen, say) can lay out
              // differently; only the journal screen pins it.
              <div className="composer-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pt-4 backdrop-blur-sm">
                <div className="mx-auto max-w-2xl px-4">
                  <JournalComposer
                    onLog={(kind, body) => handleLog(kind, body)}
                    sessionOpen={Boolean(openSession)}
                  />
                </div>
              </div>
            }
          />
        )}
      </div>

      <CharacterSheet character={openCharacter} onClose={() => setOpenCharacter(null)} />
    </div>
  )
}
