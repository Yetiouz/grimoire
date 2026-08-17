import { useEffect, useMemo, useState } from 'react'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { JournalDesktopLayout } from '../../components/domain/JournalDesktopLayout'
import { ALL_FILTER_KINDS } from '../../lib/journalFilters'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalHeader } from '../../components/domain/JournalHeader'
import { CampaignInviteModal } from '../../components/domain/CampaignInvite'
import { CampaignGmModeModal } from '../../components/domain/CampaignGmModeModal'
import { CharacterSheet } from '../../components/domain/CharacterSheet'
import { CharacterBuilder } from '../../components/domain/CharacterBuilder'
import { DiceRoller } from '../../components/domain/DiceRoller'
import { MapsOverlay } from '../../components/domain/MapsOverlay'
import { SessionAction } from '../../components/domain/SessionAction'
import { EndSessionReview } from '../../components/domain/EndSessionReview'
import { MobileJournalView } from '../../components/domain/MobileJournalView'
import { RulesChat } from '../../components/domain/RulesChat'
import { GmReference } from '../../components/domain/GmReference'
import { CampaignSearch } from '../../components/domain/CampaignSearch'
import type { FeedItem } from '../../lib/feed'
import { useJournalFeed } from '../../hooks/useJournalFeed'
import { useJournalScreenData } from '../../hooks/useJournalScreenData'
import { useCampaignRealtime } from '../../hooks/useCampaignRealtime'
import { useCampaignPresence } from '../../hooks/useCampaignPresence'
import { useGmJournalHandlers } from '../../hooks/useGmJournalHandlers'
import { useAiVoicePreference } from '../../hooks/useAiVoicePreference'
import { endSession, logJournalEntry, pauseSession, resumeSession, startSession } from '../../lib/campaigns'
import type { Campaign } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import { rollDice } from '../../lib/dice'
import type { DieType, RollMode } from '../../lib/dice'
import { gmEnabled } from '../../lib/gm'
import { configureAiSpeech } from '../../lib/speech'
import type { LogEntryKind } from '../../components/ui/LogEntryRow'
import { readCombatants } from '../../lib/encounters'

interface JournalScreenProps {
  campaign: Campaign
  authorName: string
  /** Whether the signed-in user is this campaign's `owner` column
   * (2026-08-11, join-by-code pass) — computed once in `App.tsx`,
   * where the real `user` object lives, and threaded down here rather
   * than re-derived from `authorName` (a display string, not an
   * identity check). Gates the header's Invite control: any member can
   * already read/play a campaign (RLS is membership-scoped, not
   * ownership-scoped, and always has been), but only the owner can
   * mint or view its `join_code` — see `ensure_campaign_join_code`'s
   * own owner check in migration 0023. */
  isOwner: boolean
  /** Owner request, 2026-08-15 ("i want one when starting a campaign.
   * and a toggle.") — `CampaignGmModeModal` returns the updated row
   * straight from `update_campaign_gm_mode`, and this is how that
   * reaches back to `App.tsx`'s own `campaign` state (`campaign` is a
   * prop here, this screen holds no state of its own for it). `App.tsx`
   * passes its existing `setCampaign` straight through — the same
   * setter `onOpenCampaign`/`CampaignList` already use, not a new state
   * slice. */
  onCampaignUpdated: (campaign: Campaign) => void
  onBack: () => void
  /** Wired into `JournalHeader`'s hamburger menu (2026-08-11, "make the
   * hamburger button usable"). `App.tsx`'s `AuthGate` already has
   * `signOut` in scope for `CampaignList`; this is the same call,
   * threaded one screen deeper so leaving a campaign no longer requires
   * navigating back to the campaign list first. */
  onSignOut: () => void
}

/** Last-resort fallback for `actorColor` when the signed-in member has
 * no claimed character yet (a brand-new player who joined but hasn't
 * built a PC, or narration's own case below) — not the everyday case
 * anymore for an established player. Real per-character color comes
 * from `characters.color` (migration 0005) via `myCharacter`, below. */
const FALLBACK_PLAYER_COLOR = '#9b5cff'

/** Slice 17: the header's "who's running this" word, keyed off the real
 * `campaigns.gm_mode` column (migration 0020) instead of the hardcoded
 * "Solo" every build before this slice showed regardless of the actual
 * mode. Any value this map doesn't recognize falls back to "Solo" —
 * defensive against a future mode this build doesn't know about yet,
 * rather than rendering nothing. */
const GM_MODE_LABEL: Record<string, string> = { solo: 'Solo', ai: 'AI GM', human: 'Human GM' }

/** Screen 2 of Journal v1 (SPEC): the journal, built around the
 * reusable JournalFeed. Page chrome (campaign header, "Start session",
 * the party row) lives here, not in the component — JournalFeed itself
 * has no idea it's on the journal screen.
 *
 * Owns state + handlers only; the data fetch (`useJournalScreenData`),
 * the Ask GM/Ask Rules/resolve-check handlers (`useGmJournalHandlers`),
 * and the two responsive layouts (`JournalDesktopLayout` at `xl:` and
 * up, `MobileJournalView` below it) are all split-out — BOB_fixes.md's
 * recommended cut once this file crossed CLAUDE.md's ~300-line cap,
 * plus a follow-up cut once the recommended split alone wasn't enough
 * (the file had grown past the ~390 lines that recommendation assumed).
 * All extraction, no redesign: nothing here changed behavior.
 *
 * NOTE (2026-08-09, restoration): this file was accidentally reverted
 * to its pre-split form by a concurrent session's commit (889164e) that
 * was built from a stale copy — losing the JournalDesktopLayout mount
 * and with it the save-as-note wiring on desktop. This is the split
 * version restored from fe59ee3, plus the one thing 889164e had
 * legitimately added on top: the `configureAiSpeech` effect below. */
export function JournalScreen({ campaign, authorName, isOwner, onCampaignUpdated, onBack, onSignOut }: JournalScreenProps) {
  const {
    sessions, setSessions,
    entries, setEntries,
    characters, setCharacters,
    quests,
    npcs, factions, treasure, notes, locations, npcStatBlocks, locationSecrets,
    clocks, reloadClocks,
    turnOrder, setTurnOrder,
    myMembership,
    error, setError,
    load,
  } = useJournalScreenData(campaign.id)

  // BUILD_PLAN.md item 14 (realtime/presence, 2026-08-14) — the two
  // hooks that turn this screen from "reload the page to see what
  // anyone else did" into an actually-live shared session. Both take
  // the exact same setters/ids `useJournalScreenData` above already
  // exposes; see each hook's own doc comment for why they're split
  // rather than folded into that data hook. `setTurnOrder` (Encounter
  // mode phase 2, 2026-08-14) rides the same channel as
  // sessions/entries/characters — see `useCampaignRealtime`'s own doc
  // comment on why `turn_order` is the one encounter table subscribed
  // here rather than locally inside `EncounterPanel`.
  useCampaignRealtime(campaign.id, setSessions, setEntries, setCharacters, setTurnOrder)
  const onlineMemberIds = useCampaignPresence(campaign.id, myMembership?.id ?? null)

  // Encounter mode phase 2 (BUILD_PLAN.md item 13, 2026-08-14) —
  // `PlayerCard`'s active-turn ring needs "which character (if any) is
  // up right now," not the raw `turn_order` row itself; narrowed here
  // once rather than in both `JournalDesktopLayout` and
  // `MobileJournalView`, same reasoning `activeCharacter` below is
  // computed once for its own two call sites. `null` whenever no
  // encounter is running, `combatants` is still empty (rolled nobody
  // yet), or the active combatant is a monster, not a character.
  const activeTurnCharacterId = (() => {
    if (!turnOrder) return null
    const combatants = readCombatants(turnOrder.combatants)
    const active = combatants[turnOrder.active_index]
    return active && active.combatant_type === 'character' ? active.combatant_id : null
  })()

  const [startingSession, setStartingSession] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [pausingSession, setPausingSession] = useState(false)
  const [resumingSession, setResumingSession] = useState(false)
  const [openCharacter, setOpenCharacter] = useState<Character | null>(null)
  const [diceOpen, setDiceOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  // GM Reference (BUILD_PLAN.md item 15 slice 3, 2026-08-14) — same
  // "always wired, no gm_mode gate" shape as search/builder below, not
  // rulesOpen above: see ToolsDock's own doc comment on
  // onOpenGmReference for why this one isn't feature-flag-gated.
  const [gmReferenceOpen, setGmReferenceOpen] = useState(false)
  // Slice 8: desktop-only — ToolsDock's Maps button opens this overlay.
  // Mobile's own "Maps" bottom tab renders MapsPanel inline instead (see
  // MobileJournalView's doc comment), so it needs no state here.
  const [mapsOpen, setMapsOpen] = useState(false)
  // Campaign search (2026-08-10) — unlike Rules/Ask GM, not gated on
  // gm_mode or the GM feature flag at all: it's a plain filter over
  // journal_entries/gm_chat/gm_checks that every campaign already has,
  // solo or GM'd. Always wired, matching CampaignSearch's own "no
  // separate index, just the data already on screen" design.
  const [searchOpen, setSearchOpen] = useState(false)
  // Owner-only Invite modal (2026-08-14, header rework round 2) — Invite
  // moved out of JournalHeader's button row entirely and into its
  // hamburger menu, so JournalHeader no longer owns a ready-made trigger
  // node for it, just an onOpenInvite callback. Same lifted-state shape
  // MobileJournalView already uses for its own Tools-tab Invite tile —
  // not a new pattern, just this screen's own copy of it.
  const [inviteOpen, setInviteOpen] = useState(false)
  // GM Mode settings modal (owner request, 2026-08-15: "i want one when
  // starting a campaign. and a toggle.") — same lifted-state,
  // owner-only-trigger shape as `inviteOpen` right above, opened from
  // the same hamburger menu.
  const [gmModeOpen, setGmModeOpen] = useState(false)
  // End Session Review (BUILD_PLAN.md item 7, 2026-08-14) — Stop
  // Session no longer ends the session directly; it opens this review
  // first (see EndSessionReview's own doc comment for why), and
  // handleEndSession itself only runs once the GM confirms there.
  const [endReviewOpen, setEndReviewOpen] = useState(false)
  // Character Builder (BUILD_PLAN.md slice 12) — same "always wired,
  // no gm_mode/feature-flag gate" shape as search above: any campaign
  // member or the GM can start a build, per the owner's call, so this
  // isn't conditional on anything the way `onOpenRules` is.
  const [builderOpen, setBuilderOpen] = useState(false)
  // BOB_queue task 1: which kinds show in the desktop feed — every chip
  // lit by default. Independent from MobileJournalView's own copy of
  // this same state; desktop and mobile were never asked to mirror each
  // other's filter choice, only for a filter to "survive switching tabs
  // on mobile" (an intra-mobile-shell requirement MobileJournalView
  // satisfies on its own by never unmounting across tab switches).
  const [activeFilters, setActiveFilters] = useState<Set<FilterKind>>(() => new Set(ALL_FILTER_KINDS))

  // Wires the read-aloud's AI tier (lib/speech.ts) to this campaign.
  // `ttsAvailable` is the build's own capability — VITE_GM_TTS off
  // means the tier doesn't exist in this build at all, full stop, same
  // as always. Gemini's old free tier earned that gate the hard way
  // (throttled so hard a read took ~9s when it didn't just time out);
  // 2026-08-10's swap to Fish Audio's free tier removed the reason for
  // it to stay off, so VITE_GM_TTS is now on in Vercel.
  //
  // `aiVoiceOn` is a second, independent gate on top of that: the
  // player's own choice, via the ONE global AiVoiceToggle switch by the
  // composer (UI review slice A, 2026-08-16 — it replaced the per-entry
  // pill, which repeated the same global choice down every narration
  // row; see AiVoiceToggle's own doc comment), persisted per-device by
  // useAiVoicePreference. Off now means the read-aloud feature
  // disappears entirely (no speaker buttons on any row — LogEntryRow's
  // voiceEnabled gate) rather than falling back to the browser voice;
  // on means the best tier available reads (the GM's real voice where
  // the build has it, browser voice otherwise). Because off is now
  // "silence" rather than "which engine," the switch is offered
  // regardless of ttsAvailable below — a browser-voice-only build
  // deserves the same off switch.
  const ttsAvailable = gmEnabled && import.meta.env.VITE_GM_TTS === 'true'
  const [aiVoiceOn, setAiVoiceOn] = useAiVoicePreference()

  useEffect(() => {
    configureAiSpeech(ttsAvailable && aiVoiceOn ? campaign.id : null)
    return () => configureAiSpeech(null)
  }, [campaign.id, ttsAvailable, aiVoiceOn])

  // The signed-in member's own `campaign_members.id` for this campaign,
  // once `useJournalScreenData`'s parallel load resolves it — null only
  // while loading (every legitimate visitor here already has a real
  // membership row; RLS wouldn't have let `campaign` reach this screen
  // otherwise).
  const myMembershipId = myMembership?.id ?? null

  // Character ownership (2026-08-11, join-by-code pass — "I may want to
  // play a different character with my friends"). Solo v1 used to just
  // grab "the" active character, on the reasoning that there was only
  // ever one real player in a campaign at all, so no auth-user-to-
  // character lookup existed (flagged, not built, in the comment this
  // replaces). Now that a second real person can actually join
  // (migration 0023), that assumption breaks: `myCharacter` is the
  // character whose `member_id` traces back to MY OWN membership row —
  // AND has `status === 'active'`, since the existing imported data
  // (Kimbo/Constantine/LaLa) all share one owner's `member_id` from the
  // 0004 import, so `status` is still what actually distinguishes which
  // one that owner is playing right now, not `member_id` alone.
  // `activeCharacter` keeps its old name and broader fallback (mine,
  // else any active PC in the campaign) for the call sites that just
  // want "a" relevant character to show (DiceRoller, MobileJournalView)
  // — but attribution (`handleLog`, below) uses `myCharacter` directly,
  // never the fallback, so an unclaimed player's own entries are never
  // misattributed to someone else's character name or color.
  const myCharacter = characters?.find((character) => character.member_id === myMembershipId && character.status === 'active') ?? null
  const activeCharacter = myCharacter ?? characters?.find((character) => character.status === 'active') ?? null
  const playerColor = myCharacter?.color ?? FALLBACK_PLAYER_COLOR

  const openSession = sessions?.find((session) => session.ended_at === null) ?? null

  // Real pause state (2026-08-10, migration `session_pause_resume`) —
  // `openSession` above stays keyed on `ended_at` alone (a paused
  // session is still THE open session: its id, number, and every
  // existing `openSession?.id` reference below remain valid while
  // paused), so pause is layered on as a second, independent flag
  // rather than folded into what "open" already means. `sessionActive`
  // is what every actual PLAY action should gate on — the composer,
  // dice rolls, GM asks — since a paused session means the table
  // stepped away, not that logging should silently keep working.
  const sessionPaused = Boolean(openSession?.paused_at)
  const sessionActive = Boolean(openSession) && !sessionPaused

  // Slice 17: gates every NEW AI-GM interaction (the composer's Ask
  // chips, and opening the Rules transcript to ask another question) on
  // both the build-wide feature flag AND this campaign's own gm_mode —
  // a 'solo' or 'human'-GM'd campaign has no AI GM to ask in-fiction
  // things of. Deliberately NOT used to gate useJournalFeed's own
  // rules/checks reads below (see that hook's doc comment): a campaign
  // that switches away from 'ai' should keep showing its history, only
  // stop offering new asks.
  const aiGmActive = gmEnabled && campaign.gm_mode === 'ai'

  // Header meta line ("<mode> · Session N"): the game-mode word used to
  // be a hardcoded "Solo" (no such field existed yet) — now sourced from
  // the real `campaigns.gm_mode` column (migration 0020) via
  // GM_MODE_LABEL above. The session number is, and always was, real,
  // sourced from `sessions` rather than hardcoded. Prefers the open
  // session; if none is open, falls back to the most recent one
  // (listSessions orders ascending by number, so the last array item is
  // the latest); with no sessions at all yet, says so instead of
  // showing a fabricated number.
  const gmModeLabel = GM_MODE_LABEL[campaign.gm_mode] ?? 'Solo'
  const latestSession = sessions && sessions.length > 0 ? sessions[sessions.length - 1] : null
  const headerSession = openSession ?? latestSession
  const sessionMeta = headerSession
    ? `${gmModeLabel} · Session ${headerSession.number}${sessionPaused ? ' · Paused' : ''}`
    : `${gmModeLabel} · No sessions yet`
  // BOB_queue task 1: the unified feed. Owns the gm_chat/gm_checks reads
  // and the entries+gm_chat+gm_checks merge — see hooks/useJournalFeed.ts
  // for why this isn't just inlined here. Reads are gated on the plain
  // `gmEnabled` flag (not `aiGmActive`) — see that hook's own comment.
  const { feedItems, refetchRules, refetchChecks } = useJournalFeed(campaign.id, gmEnabled, authorName, entries, sessions)

  const { handleAskGm, handleAskRules, handleResolveCheck, resolvingCheckId } = useGmJournalHandlers({
    campaignId: campaign.id,
    sessionId: openSession?.id ?? null,
    setEntries,
    refetchRules,
    refetchChecks,
    reloadScreenData: load,
    setError,
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
  // JournalFilterBar's own comment. Checks (Slice 17) get the same
  // treatment: no chip of their own, always shown regardless of the
  // active filter set. Every other kind checks membership in the
  // active set.
  const feedFilter = useMemo(
    () => (item: FeedItem) => item.kind === 'system' || item.kind === 'check' || activeFilters.has(item.kind as FilterKind),
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

  // `recapNote` (BUILD_PLAN.md item 7) flows straight through to the
  // RPC — `end_session` itself is what turns it, plus its own
  // server-computed XP/gold/HP/gear roll-up, into one `system` journal
  // entry (migration `0028_session_recap.sql`). That new entry isn't
  // echoed here the way `session` is — unlike every other command on
  // this screen, its arrival is left to `useCampaignRealtime`'s own
  // journal_entries subscription (already running on this screen since
  // BUILD_PLAN item 14), the same path a second connected player's
  // entries would take. One less thing for this handler to know about.
  async function handleEndSession(recapNote: string) {
    if (!openSession) return
    setEndingSession(true)
    try {
      const session = await endSession(campaign.id, recapNote)
      // Echo the row `end_session` actually returned rather than
      // refetch — same reasoning as handleStartSession's echo.
      setSessions((prev) => (prev ?? []).map((existing) => (existing.id === session.id ? session : existing)))
      setEndReviewOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the session.')
    } finally {
      setEndingSession(false)
    }
  }

  async function handlePauseSession() {
    if (!openSession) return
    setPausingSession(true)
    try {
      const session = await pauseSession(campaign.id)
      setSessions((prev) => (prev ?? []).map((existing) => (existing.id === session.id ? session : existing)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause the session.')
    } finally {
      setPausingSession(false)
    }
  }

  async function handleResumeSession() {
    if (!openSession) return
    setResumingSession(true)
    try {
      const session = await resumeSession(campaign.id)
      setSessions((prev) => (prev ?? []).map((existing) => (existing.id === session.id ? session : existing)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume the session.')
    } finally {
      setResumingSession(false)
    }
  }

  async function handleLog(kind: LogEntryKind, body: string) {
    if (!openSession) return
    const entry = await logJournalEntry({
      campaignId: campaign.id,
      sessionId: openSession.id,
      kind,
      body,
      // Attribution now follows the claimed character, once one exists
      // (2026-08-11) — `myCharacter`, never the broader `activeCharacter`
      // fallback, so a player with no character yet keeps their own
      // real name/the fallback tone instead of borrowing someone else's
      // identity. Narration keeps its own long-standing 'GM' special
      // case, untouched.
      actorName: kind === 'narration' ? 'GM' : (myCharacter?.name ?? authorName),
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

  // Echo the row `create_character` returned straight into the party
  // rail — same "echo what the RPC returned, don't refetch" pattern
  // every other command on this screen already uses.
  function handleCharacterCreated(created: Character) {
    setCharacters((prev) => [...(prev ?? []), created])
  }

  const sessionAction = (
    <SessionAction
      open={Boolean(openSession)}
      paused={sessionPaused}
      starting={startingSession}
      ending={endingSession}
      pausing={pausingSession}
      resuming={resumingSession}
      onStart={() => void handleStartSession()}
      onEnd={() => setEndReviewOpen(true)}
      onPause={() => void handlePauseSession()}
      onResume={() => void handleResumeSession()}
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
      <JournalHeader
        campaignName={campaign.name}
        sessionMeta={sessionMeta}
        sessionAction={sessionAction}
        onOpenInvite={isOwner ? () => setInviteOpen(true) : undefined}
        onOpenGmMode={isOwner ? () => setGmModeOpen(true) : undefined}
        onBack={onBack}
        onSignOut={onSignOut}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* DESKTOP: unchanged three-column grid, xl: and up only — see
        * JournalDesktopLayout.tsx. */}
      <JournalDesktopLayout
        characters={characters}
        activeCharacter={activeCharacter}
        onlineMemberIds={onlineMemberIds}
        activeTurnCharacterId={activeTurnCharacterId}
        quests={quests}
        npcs={npcs}
        factions={factions}
        treasure={treasure}
        notes={notes}
        locations={locations}
        npcStatBlocks={npcStatBlocks}
        locationSecrets={locationSecrets}
        clocks={clocks}
        isOwner={isOwner}
        reloadClocks={reloadClocks}
        sessions={sessions}
        entries={entries}
        error={error}
        onRetry={() => { setError(null); void load() }}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        feedItems={feedItems}
        feedFilter={feedFilter}
        openSession={openSession}
        sessionActive={sessionActive}
        sessionPaused={sessionPaused}
        onOpenCharacter={setOpenCharacter}
        onNewCharacter={() => setBuilderOpen(true)}
        onOpenDice={() => setDiceOpen(true)}
        onOpenMaps={() => setMapsOpen(true)}
        onOpenGmReference={() => setGmReferenceOpen(true)}
        gmEnabled={aiGmActive}
        onOpenRules={aiGmActive ? () => setRulesOpen(true) : undefined}
        onLog={(kind, body) => handleLog(kind, body)}
        onAskGm={handleAskGm}
        onAskRules={handleAskRules}
        aiVoiceOn={aiVoiceOn}
        onToggleAiVoice={() => setAiVoiceOn(!aiVoiceOn)}
        ttsAvailable={ttsAvailable}
        onResolveCheck={(check, source, total) => void handleResolveCheck(check, source, total)}
        resolvingCheckId={resolvingCheckId}
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
          loading={
            sessions === null ||
            entries === null ||
            characters === null ||
            quests === null ||
            npcs === null ||
            factions === null ||
            treasure === null ||
            notes === null ||
            locations === null ||
            clocks === null
          }
          activeCharacter={activeCharacter}
          characters={characters ?? []}
          onlineMemberIds={onlineMemberIds}
          quests={quests ?? []}
          npcs={npcs ?? []}
          factions={factions ?? []}
          treasure={treasure ?? []}
          notes={notes ?? []}
          locations={locations ?? []}
          npcStatBlocks={npcStatBlocks}
          locationSecrets={locationSecrets}
          clocks={clocks ?? []}
          reloadClocks={reloadClocks}
          sessions={sessions ?? []}
          sessionId={openSession?.id ?? null}
          turnOrder={turnOrder}
          onTurnOrderChange={setTurnOrder}
          activeTurnCharacterId={activeTurnCharacterId}
          items={feedItems}
          sessionOpen={sessionActive}
          sessionPaused={sessionPaused}
          onLog={(kind, body) => handleLog(kind, body)}
          gmEnabled={aiGmActive}
          onAskGm={handleAskGm}
          onAskRules={handleAskRules}
          aiVoiceOn={aiVoiceOn}
          onToggleAiVoice={() => setAiVoiceOn(!aiVoiceOn)}
          ttsAvailable={ttsAvailable}
          onResolveCheck={(check, source, total) => void handleResolveCheck(check, source, total)}
          resolvingCheckId={resolvingCheckId}
          campaignId={campaign.id}
          onOpenRules={aiGmActive ? () => setRulesOpen(true) : undefined}
          onOpenGmReference={() => setGmReferenceOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenCharacter={setOpenCharacter}
          onNewCharacter={() => setBuilderOpen(true)}
          onOpenDice={() => setDiceOpen(true)}
          isOwner={isOwner}
        />
      </div>

      <CharacterSheet
        character={openCharacter}
        sessionId={openSession?.id ?? null}
        system={campaign.system}
        onClose={() => setOpenCharacter(null)}
        onUpdate={handleCharacterUpdate}
      />

      <CharacterBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        campaignId={campaign.id}
        system={campaign.system}
        sessionId={openSession?.id ?? null}
        memberId={myMembershipId}
        onCreated={handleCharacterCreated}
      />

      <RulesChat open={rulesOpen} campaignId={campaign.id} onClose={() => setRulesOpen(false)} />

      <GmReference open={gmReferenceOpen} system={campaign.system} onClose={() => setGmReferenceOpen(false)} />

      <CampaignSearch open={searchOpen} items={feedItems} sessions={sessions ?? []} onClose={() => setSearchOpen(false)} />

      <MapsOverlay
        open={mapsOpen}
        campaignId={campaign.id}
        isOwner={isOwner}
        characters={characters ?? []}
        sessionId={openSession?.id ?? null}
        turnOrder={turnOrder}
        onTurnOrderChange={setTurnOrder}
        onClose={() => setMapsOpen(false)}
      />

      <CampaignInviteModal campaignId={campaign.id} open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <CampaignGmModeModal campaign={campaign} open={gmModeOpen} onClose={() => setGmModeOpen(false)} onUpdated={onCampaignUpdated} />

      <EndSessionReview
        open={endReviewOpen}
        campaignId={campaign.id}
        session={openSession}
        characters={characters ?? []}
        ending={endingSession}
        onClose={() => setEndReviewOpen(false)}
        onConfirm={(note) => void handleEndSession(note)}
      />

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
