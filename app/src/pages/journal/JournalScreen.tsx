import { useEffect, useState } from 'react'
import { ColumnHeader } from '../../components/ui/ColumnHeader'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { JournalFeed } from '../../components/domain/JournalFeed'
import { JournalComposer } from '../../components/domain/JournalComposer'
import { JournalHeader } from '../../components/domain/JournalHeader'
import { PlayerCard } from '../../components/domain/PlayerCard'
import { CharacterSheet } from '../../components/domain/CharacterSheet'
import { DiceRoller } from '../../components/domain/DiceRoller'
import { QuestLogPanel } from '../../components/domain/QuestLogPanel'
import { SessionAction } from '../../components/domain/SessionAction'
import { ToolsDock } from '../../components/domain/ToolsDock'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'
import { endSession, listJournalEntries, listSessions, logJournalEntry, startSession } from '../../lib/campaigns'
import type { Campaign, CampaignSession, JournalEntry } from '../../lib/campaigns'
import { listCharacters } from '../../lib/characters'
import type { Character } from '../../lib/characters'
import { rollDice } from '../../lib/dice'
import type { DieType, RollMode } from '../../lib/dice'
import { listQuests } from '../../lib/quests'
import type { Quest } from '../../lib/quests'

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
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [openCharacter, setOpenCharacter] = useState<Character | null>(null)
  const [diceOpen, setDiceOpen] = useState(false)

  async function load() {
    setError(null)
    try {
      const [sessionRows, entryRows, characterRows, questRows] = await Promise.all([
        listSessions(campaign.id),
        listJournalEntries(campaign.id),
        listCharacters(campaign.id),
        listQuests(campaign.id),
      ])
      setSessions(sessionRows)
      setEntries(entryRows)
      setCharacters(characterRows)
      setQuests(questRows)
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
  // Journal column header label: the mockup's `.col-head` shows a scene
  // title we have no equivalent field for (no encounter/scene model
  // exists yet) — the session's own real `title` is the closest honest
  // substitute when set (only session 1's imported "…Prologue" has one
  // today), falling back to the same session meta the header already
  // shows rather than inventing scene text.
  const journalColumnLabel = headerSession?.title ?? sessionMeta

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

  async function handleEndSession() {
    if (!openSession) return
    setEndingSession(true)
    try {
      const session = await endSession(campaign.id)
      // Echo the row `end_session` actually returned rather than
      // refetch — same reasoning as handleStartSession's echo.
      setSessions((prev) => (prev ?? []).map((existing) => (existing.id === session.id ? session : existing)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the session.')
    } finally {
      setEndingSession(false)
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

  // Thin wrapper so DiceRoller never touches Supabase directly (same
  // component-boundary rule PlayerCard/CharacterSheet already follow) —
  // it just calls this prop and gets a typed result back.
  async function handleRollDice(die: DieType, count: number, mode: RollMode) {
    return rollDice(campaign.id, die, count, mode)
  }

  const sessionAction = (
    <SessionAction
      open={Boolean(openSession)}
      starting={startingSession}
      ending={endingSession}
      onStart={() => void handleStartSession()}
      onEnd={() => void handleEndSession()}
    />
  )

  return (
    <div className="min-h-screen">
      <JournalHeader campaignName={campaign.name} sessionMeta={sessionMeta} sessionAction={sessionAction} onBack={onBack} />

      {/* composer-clearance (index.css): the composer is pinned fixed to
       * the viewport below, outside this container's normal flow, so
       * without reserved bottom space its bar would sit on top of the
       * feed's last few rows instead of below them.
       *
       * Three-column at xl: and up, matching the vision-handoff
       * mockup's actual layout (party rail / journal / quest rail):
       * PlayerCards moved out of the main column into their own left
       * rail, journal feed stays the middle column, Quest Log stays
       * the right rail. Bumped the breakpoint from the Quest Log
       * pass's lg: (1024px) to xl: (1280px) now that there are three
       * real columns to fit, not two — at lg:'s own 1024px minimum
       * viewport width, party(256) + gap + feed + quest(320) would
       * squeeze the middle reading column uncomfortably narrow or
       * force horizontal scroll; xl: leaves the feed a reasonable
       * ~650px even with both rails present. Below xl: everything
       * still stacks in one column — party, then feed, then quests —
       * there's no room for real columns on a phone or a narrower
       * laptop window, and both rails stay unconditionally rendered
       * there too, just lower on the page rather than gated behind a
       * click.
       *
       * One known seam left as-is rather than solved here: the fixed
       * composer bar below is independently `max-w-2xl`/centered on
       * the full viewport, so at xl: widths it won't line up exactly
       * under the middle column — a real fix would need the composer
       * to track that column's actual position, not just its own
       * centered max-width. */}
      <div className="composer-clearance mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 xl:max-w-7xl xl:flex-row xl:items-start">
        {/* Party rail (BUILD_PLAN.md slice 3, moved to its own column
         * here): PlayerCards, left of the feed at xl: and up — closer
         * to the mockup's full left rail than the old stacked-above-
         * the-feed placement, though still simple vertical cards
         * rather than the mockup's initiative-order/turn-glow
         * behavior, which is encounter-mode work (slice 10). Awaiting
         * PCs (Constantine, LaLa) render dimmed rather than filtered
         * out, per PlayerCard's own resolved-mockup behavior. */}
        {characters !== null && characters.length > 0 && (
          <div className="flex flex-col gap-2 xl:w-64 xl:shrink-0">
            <ColumnHeader left="Party" />
            {characters.map((character) => (
              <PlayerCard key={character.id} character={character} onClick={() => setOpenCharacter(character)} />
            ))}
            {/* Tools dock (visual-reconciliation pass): sits right below
             * the party cards, not next to Log inside the composer
             * anymore. `mt-auto` is there for when this rail is taller
             * than its content, but doesn't flush it to the bottom of
             * the viewport the way the mockup's dock sits — that needs a
             * fixed-height, independently-scrolling three-column shell
             * (`overflow:hidden` body, each column `overflow-y:auto`),
             * which is a real architecture change (scroll model, the
             * fixed composer bar's own clearance math) well past this
             * pass's header/columns/dock scope — flagging rather than
             * quietly doing it. Gated on `openSession`, same rule the
             * dice trigger always had — moving columns didn't change
             * when rolling is actually allowed. One accepted gap: since
             * this dock now lives inside the party-rail's own
             * `characters.length > 0` gate, Roll disappears along with
             * the whole rail on the (currently only theoretical, no real
             * campaign hits it) zero-character empty state, where before
             * it stayed reachable from the composer regardless. */}
            <ToolsDock onOpenDice={() => setDiceOpen(true)} diceDisabled={!openSession} className="mt-auto" />
          </div>
        )}

        <div className="flex flex-1 flex-col xl:min-w-0">
          <ColumnHeader left={journalColumnLabel} />

          <div className="flex flex-1 flex-col gap-4 pt-4">
            {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}

            {(sessions === null || entries === null || characters === null || quests === null) && !error && (
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
                  // Fixed to the viewport bottom, per the approved
                  // journal-mockup.html (`.composer`): the feed scrolls
                  // behind it rather than pushing it down the page. Wrapped
                  // here at the call site — not inside JournalComposer
                  // itself — so the component stays a plain content block
                  // that any future host (a review screen, say) can lay out
                  // differently; only the journal screen pins it.
                  <div className="composer-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pt-4 backdrop-blur-sm">
                    <div className="mx-auto max-w-2xl px-4">
                      <JournalComposer onLog={(kind, body) => handleLog(kind, body)} sessionOpen={Boolean(openSession)} />
                    </div>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {/* Quest Log rail: sticky alongside the feed at xl: (it scrolls
         * into view and then stays put, matching the mockup's always-
         * visible panel); a plain stacked block below the feed on
         * narrower viewports. Rendered only once quests have actually
         * loaded and there's at least one — same "don't show an empty
         * section" discipline the party rail uses. */}
        {quests !== null && quests.length > 0 && (
          <div className="xl:sticky xl:top-6 xl:w-80 xl:shrink-0">
            <QuestLogPanel quests={quests} />
          </div>
        )}
      </div>

      <CharacterSheet character={openCharacter} onClose={() => setOpenCharacter(null)} />

      <DiceRoller
        open={diceOpen}
        onClose={() => setDiceOpen(false)}
        character={activeCharacter}
        onRoll={handleRollDice}
        onLog={(body) => handleLog('roll', body)}
      />
    </div>
  )
}
