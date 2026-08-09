import { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnCard } from '../../components/ui/ColumnCard'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { text } from '../../lib/typography'
import { JournalFeed } from '../../components/domain/JournalFeed'
import { JournalFilterBar } from '../../components/domain/JournalFilterBar'
import { ALL_FILTER_KINDS } from '../../lib/journalFilters'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalComposer } from '../../components/domain/JournalComposer'
import { JournalHeader } from '../../components/domain/JournalHeader'
import { PlayerCard } from '../../components/domain/PlayerCard'
import { CharacterSheet } from '../../components/domain/CharacterSheet'
import { DiceRoller } from '../../components/domain/DiceRoller'
import { QuestLogPanel } from '../../components/domain/QuestLogPanel'
import { SessionAction } from '../../components/domain/SessionAction'
import { ToolsDock } from '../../components/domain/ToolsDock'
import { MobileJournalView } from '../../components/domain/MobileJournalView'
import { RulesChat } from '../../components/domain/RulesChat'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'
import type { FeedItem } from '../../lib/feed'
import { useJournalFeed } from '../../hooks/useJournalFeed'
import { endSession, listJournalEntries, listSessions, logJournalEntry, startSession } from '../../lib/campaigns'
import type { Campaign, CampaignSession, JournalEntry } from '../../lib/campaigns'
import { listCharacters } from '../../lib/characters'
import type { Character } from '../../lib/characters'
import { rollDice } from '../../lib/dice'
import type { DieType, RollMode } from '../../lib/dice'
import { askGm, gmEnabled } from '../../lib/gm'
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

/** BOB_queue task 1: "GM entries currently carry no actor_color, so
 * set it when logging (JournalScreen.handleAskGm) and let LogEntryRow
 * do the rest." Matches index.css's `--color-cyan` and the gm-composer
 * mockup's own cyan Ask GM identity — the same accent everywhere the
 * GM already has a color, just now reaching the journal entry too. */
const GM_CYAN = '#35f0ff'

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
  const [rulesOpen, setRulesOpen] = useState(false)
  // BOB_queue task 1: which kinds show in the desktop feed — every chip
  // lit by default. Independent from MobileJournalView's own copy of
  // this same state; desktop and mobile were never asked to mirror each
  // other's filter choice, only for a filter to "survive switching tabs
  // on mobile" (an intra-mobile-shell requirement MobileJournalView
  // satisfies on its own by never unmounting across tab switches).
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(() => new Set(ALL_FILTER_KINDS))

  // useCallback so the load-on-mount effect can honestly list `load` as
  // its dependency (react-hooks/exhaustive-deps runs at --max-warnings=0
  // in verify — this warning was failing CI on every push).
  const load = useCallback(async () => {
    // Deliberately no synchronous setState in here — error-clearing on
    // retry lives in the ErrorBanner's onRetry event handler instead.
    // (react-hooks/set-state-in-effect flags the effect call site
    // regardless; see the eslint-disable there.)
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
  }, [campaign.id])

  useEffect(() => {
    // Mount/param-change data fetch — the one canonical effect use.
    // react-hooks/set-state-in-effect statically flags ANY setState
    // reachable from a function called in the effect body, even calls
    // that only run after an await (the rule doesn't model async
    // boundaries), so fetch-on-mount needs a targeted opt-out here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

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
  // isn't just inlined here (this file was already over CLAUDE.md's
  // ~300-line cap before task 1 touched it).
  const { feedItems, refetchRules } = useJournalFeed(campaign.id, gmEnabled, authorName, entries, sessions)

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

  // Slice 16. Same thin-wrapper boundary as handleRollDice below: the
  // composer never touches Supabase itself. Note there is no try/catch and
  // no setError — `askGm` never rejects, and a GM failure is deliberately
  // not a screen-level error. It renders inside the composer and leaves
  // everything else, Log mode included, working.
  //
  // A successful reply is written into the journal as a `narration` entry
  // authored by the GM — the same shape the imported GM entries already
  // have, so it reads as part of the campaign rather than a side channel.
  // Owner's decision, overriding the earlier show-and-forget behaviour.
  //
  // BOB_queue task 1: `actorColor` is now set to GM_CYAN rather than left
  // undefined — previously it didn't matter because LogEntryRow forced
  // every narration entry to the same muted ink-dim regardless of color;
  // now that that override is gone (LogEntryRow.tsx), this is what
  // actually makes AI GM narration render in its own color instead of
  // falling back to the same gray a hand-typed narration entry gets.
  //
  // Two consequences worth knowing. Out-of-character questions ("remind me
  // who X is") get logged too, because the GM has no way yet to say which
  // of its replies is narration and which is a lookup — phase 3's
  // `log_journal_entry` tool is what lets it make that call itself. And
  // journal entries can be amended but never deleted, so a reply logged in
  // error is corrected, not removed.
  //
  // The logging failure is swallowed on purpose: the GM already answered,
  // and losing the entry is much better than surfacing an error over a
  // reply the player can still read in the composer.
  async function handleAskGm(input: string) {
    const result = await askGm(campaign.id, openSession?.id ?? null, input)

    if (result.status === 'ok' && result.message.trim() && openSession) {
      try {
        const entry = await logJournalEntry({
          campaignId: campaign.id,
          sessionId: openSession.id,
          kind: 'narration',
          body: result.message.trim(),
          actorName: 'GM',
          actorColor: GM_CYAN,
        })
        setEntries((prev) => [...(prev ?? []), entry])
        return { ...result, logged: true }
      } catch {
        return { ...result, logged: false }
      }
    }

    return result
  }

  // The out-of-character surface. Same call, different mode — and
  // deliberately no journal write on this path: a rules answer is table
  // talk, and the whole point of the separation is that it cannot end up
  // in the campaign record. It persists to `gm_chat` server-side and is
  // read back from Tools -> Rules, and (BOB_queue task 1) merged into the
  // unified feed for display via useJournalFeed's refetchRules — the
  // edge function writes the new gm_chat rows itself, so the client has
  // to re-read rather than echo a result it was never given.
  async function handleAskRules(input: string) {
    const result = await askGm(campaign.id, openSession?.id ?? null, input, 'rules')
    if (result.status === 'ok') void refetchRules()
    return result
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
    // PAGE never scrolls; each column card scrolls itself. Mobile layout
    // slice: this used to be `min-h-svh` (page scrolls) below `xl:` and
    // only fixed-height at `xl:` and up, matching the old "everything
    // stacks in one column" fallback. That no longer fits: a tab-bar
    // shell needs its top bar and tab bar pinned to the viewport, not
    // scrolling away with the content, matching
    // `mobile-view-mockup.html`'s own real-phone CSS — so fixed-height
    // + `overflow-hidden` now applies at every breakpoint, and
    // `MobileJournalView` owns its own internal scroll the same way
    // each desktop `ColumnCard` already does.
    //
    // The unit is `dvh`, NOT `svh` (which the mockup and this shell's
    // first version both used). `svh` is the SMALL viewport height —
    // the height with every mobile browser toolbar expanded — so it
    // permanently reserves that space even while the toolbars are
    // hidden, which on a real iPhone left a ~138px dead band of page
    // background below the tab bar. `dvh` tracks the viewport's actual
    // current height. The usual argument against `dvh` (layout jump as
    // toolbars show/hide mid-scroll) doesn't apply here: this page
    // never scrolls, so the toolbars never toggle from scrolling it.
    // `Overlay`'s slide-up variant already used `100dvh` — that
    // mismatch is exactly why a full-screen sheet filled the phone
    // correctly while the shell behind it did not.
    <div className="flex h-dvh flex-col overflow-hidden">
      <JournalHeader campaignName={campaign.name} sessionMeta={sessionMeta} sessionAction={sessionAction} onBack={onBack} />

      {/* DESKTOP: unchanged three-column grid, xl: and up only. */}
      <div className="hidden flex-1 grid-cols-1 gap-3 p-4 xl:grid xl:min-h-0 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        {/* LEFT: Party card + Tools card (v11: members grouped in one
          * card, tools in their own card below it) — each a ColumnCard,
          * the card-shell layout primitive (CLAUDE.md). */}
        {characters !== null && characters.length > 0 && (
          <div className="flex min-h-0 flex-col gap-3">
            <ColumnCard headerLeft="Party" bodyClassName="gap-2" className="xl:flex-1">
              {characters.map((character) => (
                <PlayerCard key={character.id} character={character} onClick={() => setOpenCharacter(character)} />
              ))}
            </ColumnCard>
            <ColumnCard headerLeft="Tools">
              <ToolsDock
                onOpenDice={() => setDiceOpen(true)}
                diceDisabled={!openSession}
                onOpenRules={gmEnabled ? () => setRulesOpen(true) : undefined}
              />
            </ColumnCard>
          </div>
        )}

        {/* CENTER: the journal card — sticky header, internally
          * scrolling feed, composer pinned to the card's foot.
          * BOB_queue task 1, final placement (owner: "make the filters
          * smaller and put it in the header"): JournalFilterBar rides
          * ColumnHeader's right slot as compact chips. It briefly held
          * a pinned subheader strip of its own — and before that
          * shipped invisible inside the scrolling body — but the
          * header slot kills the extra row AND the visual "same chips
          * twice" confusion with the composer's kind pickers in one
          * move. Gated on the same loaded state as the feed so chips
          * don't render over the skeleton. */}
        <ColumnCard
          headerLeft={journalColumnLabel}
          headerRight={
            sessions !== null && entries !== null ? (
              <JournalFilterBar compact active={activeFilters} onToggle={toggleFilter} showRules={gmEnabled} />
            ) : undefined
          }
          bodyClassName="gap-3"
          footer={
            <JournalComposer
              onLog={(kind, body) => handleLog(kind, body)}
              sessionOpen={Boolean(openSession)}
              gmEnabled={gmEnabled}
              onAskGm={handleAskGm}
              onAskRules={handleAskRules}
              campaignId={campaign.id}
            />
          }
        >
          {error && <ErrorBanner onRetry={() => { setError(null); void load() }}>{error}</ErrorBanner>}

          {(sessions === null || entries === null || characters === null || quests === null) && !error && (
            <SkeletonGroup label="Loading journal" className="gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </SkeletonGroup>
          )}

          {sessions !== null && entries !== null && (
            <JournalFeed items={feedItems} sessions={sessions} filter={feedFilter} />
          )}
        </ColumnCard>

        {/* RIGHT: quest card — same shell, independent scroll. */}
        {quests !== null && quests.length > 0 && (
          <ColumnCard
            headerLeft="Quest Log"
            headerRight={
              <span className={text.label}>
                {quests.length} {quests.length === 1 ? 'Quest' : 'Quests'}
              </span>
            }
            bodyClassName="gap-2"
          >
            <QuestLogPanel quests={quests} />
          </ColumnCard>
        )}
      </div>

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
