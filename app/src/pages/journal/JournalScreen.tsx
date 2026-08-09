import { useMemo, useState } from 'react'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { JournalDesktopLayout } from '../../components/domain/JournalDesktopLayout'
import { ALL_FILTER_KINDS } from '../../lib/journalFilters'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalHeader } from '../../components/domain/JournalHeader'
import { CharacterSheet } from '../../components/domain/CharacterSheet'
import { DiceRoller } from '../../components/domain/DiceRoller'
import { SessionAction } from '../../components/domain/SessionAction'
import { MobileJournalView } from '../../components/domain/MobileJournalView'
import { RulesChat } from '../../components/domain/RulesChat'
import type { FeedItem } from '../../lib/feed'
import { useJournalFeed } from '../../hooks/useJournalFeed'
import { useJournalScreenData } from '../../hooks/useJournalScreenData'
import { useGmJournalHandlers } from '../../hooks/useGmJournalHandlers'
import { endSession, logJournalEntry, startSession } from '../../lib/campaigns'
import type { Campaign } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import { rollDice } from '../../lib/dice'
import type { DieType, RollMode } from '../../lib/dice'
import { gmEnabled } from '../../lib/gm'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'

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
 * has no idea it's on the journal screen.
 *
 * Owns state + handlers only; the data fetch (`useJournalScreenData`),
 * the Ask GM/Ask Rules handlers (`useGmJournalHandlers`), and the two
 * responsive layouts (`JournalDesktopLayout` at `xl:` and up,
 * `MobileJournalView` below it) are all split-out — BOB_fixes.md's
 * recommended cut once this file crossed CLAUDE.md's ~300-line cap,
 * plus a follow-up cut once the recommended split alone wasn't enough
 * (the file had grown past the ~390 lines that recommendation assumed).
 * All extraction, no redesign: nothing here changed behavior. */
export function JournalScreen({ campaign, authorName, onBack }: JournalScreenProps) {
  const {
    sessions, setSessions,
    entries, setEntries,
    characters, setCharacters,
    quests,
    error, setError,
    load,
  } = useJournalScreenData(campaign.id)

  const [startingSession, setStartingSession] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [openCharacter, setOpenCharacter] = useState<Character | null>(null)
  const [diceOpen, setDiceOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  // BOB_queue task 1: which kinds show in the desktop feed — every chip
  // lit by default. Independent from MobileJournalView's own copy of
  // this same state; desktop and mobile were never asked to mirror each
  // other's filter choice, only for a filter to "survive switching tabs
  // on mobile" (an intra-mobile-shell requirement MobileJournalView
  // satisfies on its own by never unmounting across tab switches).
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(() => new Set(ALL_FILTER_KINDS))

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

  // BOB_queue task 1: the unified feed. Owns the gm_chat read and the
  // entries+gm_chat merge — see hooks/useJournalFeed.ts for why this
  // isn't just inlined here.
  const { feedItems, refetchRules } = useJournalFeed(campaign.id, gmEnabled, authorName, entries, sessions)

  const { handleAskGm, handleAskRules } = useGmJournalHandlers({
    campaignId: campaign.id,
    sessionId: openSession?.id ?? null,
    setEntries,
    refetchRules,
  })

  function toggleFilter(kind: FilterKind) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  // System entries have no chip and are never muted — see
  // JournalFilterBar's own comment. Every other kind checks membership
  // in the active set.
  const feedFilter = useMemo(
    () => (item: FeedItem) => item.kind === 'system' || activeFilters.has(item.kind as FilterKind),
    [activeFilters],
  )

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

  // Character commands (BUILD_PLAN.md slice 6) echo through this same
  // "echo the row the RPC returned" pattern as start/end session —
  // updates both the party-rail list and the open sheet (the only
  // place these commands are triggered from) so neither goes stale
  // without a refetch.
  function handleCharacterUpdate(updated: Character) {
    setCharacters((prev) => (prev ?? []).map((character) => (character.id === updated.id ? updated : character)))
    setOpenCharacter(updated)
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
    // v11 shell (SPEC decision log, Aug 4): fixed-height app frame — the
    // PAGE never scrolls; each column card scrolls itself. `dvh`, not
    // `svh`: `svh` permanently reserves space for every mobile browser
    // toolbar even while hidden (a ~138px dead band on a real iPhone);
    // `dvh` tracks the viewport's actual current height, and this page
    // never scrolls so the toolbars never toggle mid-scroll the way the
    // usual argument against `dvh` assumes. `MobileJournalView` and
    // each desktop `ColumnCard` own their own internal scroll, matching
    // `Overlay`'s slide-up variant, which already used `100dvh`.
    <div className="flex h-dvh flex-col overflow-hidden">
      <JournalHeader campaignName={campaign.name} sessionMeta={sessionMeta} sessionAction={sessionAction} onBack={onBack} />

      {/* DESKTOP: unchanged three-column grid, xl: and up only — see
        * JournalDesktopLayout.tsx. */}
      <JournalDesktopLayout
        characters={characters}
        quests={quests}
        sessions={sessions}
        entries={entries}
        error={error}
        onRetry={() => { setError(null); void load() }}
        journalColumnLabel={journalColumnLabel}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        feedItems={feedItems}
        feedFilter={feedFilter}
        openSession={openSession}
        onOpenCharacter={setOpenCharacter}
        onOpenDice={() => setDiceOpen(true)}
        gmEnabled={gmEnabled}
        onOpenRules={gmEnabled ? () => setRulesOpen(true) : undefined}
        onLog={(kind, body) => handleLog(kind, body)}
        onAskGm={handleAskGm}
        onAskRules={handleAskRules}
        campaignId={campaign.id}
      />

      {/* MOBILE: tab-bar shell, below xl: only. Renders even while data
        * is still loading (MobileJournalView handles its own loading/
        * error states for the home/journal view, matching the desktop
        * column's own inline handling above) so the tab bar and top bar
        * are present immediately rather than popping in after the
        * first fetch resolves. */}
      <div className="flex min-h-0 flex-1 flex-col xl:hidden">
        {error && (
          <div className="px-4 pt-3">
            <ErrorBanner onRetry={() => { setError(null); void load() }}>{error}</ErrorBanner>
          </div>
        )}
        <MobileJournalView
          loading={sessions === null || entries === null || characters === null || quests === null}
          activeCharacter={activeCharacter}
          characters={characters ?? []}
          quests={quests ?? []}
          sessions={sessions ?? []}
          items={feedItems}
          sessionOpen={Boolean(openSession)}
          onLog={(kind, body) => handleLog(kind, body)}
          gmEnabled={gmEnabled}
          onAskGm={handleAskGm}
          onAskRules={handleAskRules}
          campaignId={campaign.id}
          onOpenRules={gmEnabled ? () => setRulesOpen(true) : undefined}
          onOpenCharacter={setOpenCharacter}
          onOpenDice={() => setDiceOpen(true)}
        />
      </div>

      <CharacterSheet
        character={openCharacter}
        sessionId={openSession?.id ?? null}
        onClose={() => setOpenCharacter(null)}
        onUpdate={handleCharacterUpdate}
      />

      <RulesChat open={rulesOpen} campaignId={campaign.id} onClose={() => setRulesOpen(false)} />

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
