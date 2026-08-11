import { useState } from 'react'
import { Button } from '../ui/Button'
import { ColumnCard } from '../ui/ColumnCard'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../ui/Skeleton'
import { JournalFeed } from './JournalFeed'
import { JournalFilterBar } from './JournalFilterBar'
import type { FilterKind } from '../../lib/journalFilters'
import { JournalComposer } from './JournalComposer'
import { PlayerCard } from './PlayerCard'
import { WorldTabs } from './WorldTabs'
import { ToolsDock } from './ToolsDock'
import type { LogEntryKind } from '../ui/LogEntryRow'
import type { FeedItem } from '../../lib/feed'
import type { GmCheck, ResolveSource } from '../../lib/checks'
import type { GmTurnResult } from '../../lib/gm'
import type { CampaignSession, JournalEntry } from '../../lib/campaigns'
import type { Character } from '../../lib/characters'
import type { Quest } from '../../lib/quests'
import type { Faction, Note, Npc, NpcStatBlock, Treasure } from '../../lib/world'

interface JournalDesktopLayoutProps {
  characters: Character[] | null
  quests: Quest[] | null
  /** BUILD_PLAN.md slice 9 (`WorldTabs`) — loaded alongside `quests` by
   * `useJournalScreenData`, threaded straight through the same way
   * `quests` already is. `npcStatBlocks` is empty for a non-owner viewer
   * (RLS-filtered server-side); see `WorldTabs`' own doc comment. */
  npcs: Npc[] | null
  factions: Faction[] | null
  treasure: Treasure[] | null
  /** `WorldTabs`' 5th tab (2026-08-10) — same load-up-front treatment as
   * `npcs`/`factions`/`treasure`. */
  notes: Note[] | null
  npcStatBlocks: Map<string, NpcStatBlock>
  sessions: CampaignSession[] | null
  entries: JournalEntry[] | null
  error: string | null
  onRetry: () => void
  journalColumnLabel: string
  activeFilters: Set<FilterKind>
  onToggleFilter: (kind: FilterKind) => void
  feedItems: FeedItem[]
  feedFilter: (item: FeedItem) => boolean
  openSession: CampaignSession | null
  /** Whether the open session is actually accepting play right now —
   * false both when there's no open session AND when there is one but
   * it's paused (2026-08-10). Everything that logs/spends the table's
   * turn (the composer, dice rolls, "save as note") gates on this, not
   * on `Boolean(openSession)` — a paused session is still `openSession`
   * (its id/number stay valid), it just isn't live play. */
  sessionActive: boolean
  /** Forwarded to `JournalComposer` purely for its placeholder copy
   * ("paused" vs. "no session yet") — the actual gate is `sessionActive`
   * above. */
  sessionPaused?: boolean
  onOpenCharacter: (character: Character) => void
  /** Opens `CharacterBuilder` (2026-08-11) — rendered as a plain button
   * inside the Party card, always available once `characters` has
   * loaded, party-empty or not (see this file's own doc comment on why
   * the Party card's mount condition changed to make that true). */
  onNewCharacter: () => void
  onOpenDice: () => void
  /** Slice 8 (Maps overlay) — threaded straight to `ToolsDock`, same as
   * `MobileJournalView`'s own copy of this prop. Not gated behind
   * `gmEnabled` (unlike `onOpenRules` below): Maps is campaign data any
   * member can view, not a GM-only feature. */
  onOpenMaps: () => void
  /** Slice 16 — threaded straight through to `JournalComposer`/
   * `JournalFilterBar`, same optional-and-off-by-default shape
   * `MobileJournalView` already takes for its own copy of this prop.
   * Slice 17: the caller now passes its own `gm_mode`-gated value here
   * (`aiGmActive` in `JournalScreen`), not the raw feature flag — this
   * component doesn't know or care about that distinction, it just
   * gates the same two things it always has. */
  gmEnabled?: boolean
  /** Pre-gated by the caller (`aiGmActive ? () => setRulesOpen(true) :
   * undefined`), same convention `MobileJournalView` already uses —
   * this component doesn't re-derive the gate itself. */
  onOpenRules?: () => void
  onLog: (kind: LogEntryKind, body: string) => Promise<void>
  onAskGm?: (input: string) => Promise<GmTurnResult>
  onAskRules?: (input: string) => Promise<GmTurnResult>
  /** AI-voice on/off pill (2026-08-10) — forwarded straight to
   * `JournalFeed`, see its own doc comment. Both omitted together when
   * the voice tier doesn't exist in this build. */
  aiVoiceOn?: boolean
  onToggleAiVoice?: () => void
  /** Whether the voice tier exists in this build (`VITE_GM_TTS`) —
   * forwarded straight to `JournalComposer`'s Voice budget bar
   * (2026-08-10). Distinct from `aiVoiceOn` above: that's the player's
   * own on/off choice, this is the build's capability. */
  ttsAvailable?: boolean
  /** Slice 17: forwarded straight to `JournalFeed` — see its own doc
   * comment. Both optional, same "omit for read-only" convention every
   * other feed callback here already follows. */
  onResolveCheck?: (check: GmCheck, source: ResolveSource, total?: number) => void
  resolvingCheckId?: string | null
  campaignId: string
}

/**
 * The `xl:` and up three-column grid — Party+Tools, the journal card,
 * Quest Log — split out of `JournalScreen.tsx` (that file was 460
 * lines, over CLAUDE.md's ~300-line cap; BOB_fixes.md's recommended
 * cut). Extraction only, not a redesign: every prop here is exactly
 * what the JSX already closed over before the split, just threaded
 * explicitly instead of reaching into `JournalScreen`'s own scope.
 *
 * `MobileJournalView` is this component's sibling for the same split —
 * `JournalScreen` now owns state + handlers and mounts one or the
 * other (both, actually; Tailwind's `xl:` classes pick which one is
 * visible, matching every other responsive decision in this app), so
 * neither layout is hand-built twice against drifting copies of the
 * same data.
 */
export function JournalDesktopLayout({
  characters,
  quests,
  npcs,
  factions,
  treasure,
  notes,
  npcStatBlocks,
  sessions,
  entries,
  error,
  onRetry,
  journalColumnLabel,
  activeFilters,
  onToggleFilter,
  feedItems,
  feedFilter,
  openSession,
  sessionActive,
  sessionPaused,
  onOpenCharacter,
  onNewCharacter,
  onOpenDice,
  onOpenMaps,
  gmEnabled,
  onOpenRules,
  onLog,
  onAskGm,
  onAskRules,
  aiVoiceOn,
  onToggleAiVoice,
  ttsAvailable,
  onResolveCheck,
  resolvingCheckId,
  campaignId,
}: JournalDesktopLayoutProps) {
  // "Save as note" quick action (2026-08-09): local to this layout, not
  // lifted to JournalScreen — JournalDesktopLayout and MobileJournalView
  // are both always-mounted siblings (Tailwind's `xl:` classes just
  // toggle which one is visible), so each keeps its own independent
  // seed state rather than sharing one the other could stomp.
  const [noteSeed, setNoteSeed] = useState<{ body: string } | null>(null)
  return (
    // Right column widened 20rem -> 26rem (2026-08-10, owner: "widen quest
    // log panel so the top nav fits") — WorldTabs' tab row (Quests/People/
    // Factions/Loot) plus ColumnCard's own p-3 padding was tighter than
    // comfortable at 20rem even with the shortened variant-C labels.
    // Left column widened 16rem -> 18rem, same day, same reasoning (owner:
    // "expand the party frame so the gold can fit on the same line as the
    // other stats") — PlayerCard's stat row (HP/AC/BAG/GP) was wrapping
    // GP onto its own line at 16rem once a character had gear-slot data to
    // show alongside HP/AC. The center journal's minmax(0,1fr) is
    // unchanged; both side columns' extra width comes entirely out of its
    // flexible share.
    <div className="hidden flex-1 grid-cols-1 gap-3 p-4 xl:grid xl:min-h-0 xl:grid-cols-[18rem_minmax(0,1fr)_26rem]">
      {/* LEFT: Party card + Tools card (v11: members grouped in one
        * card, tools in their own card below it) — each a ColumnCard,
        * the card-shell layout primitive (CLAUDE.md). */}
      {/* 2026-08-11: was gated on `characters.length > 0` — which hid
        * the Party card, and with it the only way to reach the new
        * Character Builder, on any campaign with an empty party (every
        * brand-new campaign, by definition). Gating on `!== null`
        * alone keeps the card mounted once the load resolves either
        * way, with a real `EmptyState` standing in for the PlayerCard
        * list when there's nothing to show yet — was a bare caption
        * line until a visual review caught the mismatch with
        * `MobileJournalView`'s own Party tab (which already used
        * `EmptyState` here) and with `WorldTabs`, which already nests
        * `EmptyState` inside this same desktop grid's Quest Log
        * `ColumnCard` (2026-08-11 fix, same copy as the mobile copy). */}
      {characters !== null && (
        <div className="flex min-h-0 flex-col gap-3">
          <ColumnCard headerLeft="Party" bodyClassName="gap-2" className="xl:flex-1">
            {characters.map((character) => (
              <PlayerCard key={character.id} character={character} onClick={() => onOpenCharacter(character)} />
            ))}
            {characters.length === 0 && (
              <EmptyState icon="party" title="No party yet" description="Characters you add to this campaign show up here." />
            )}
            <Button type="button" variant="dashed" onClick={onNewCharacter}>+ New Character</Button>
          </ColumnCard>
          <ColumnCard headerLeft="Tools">
            <ToolsDock onOpenDice={onOpenDice} diceDisabled={!sessionActive} onOpenRules={onOpenRules} onOpenMaps={onOpenMaps} />
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
            <JournalFilterBar compact active={activeFilters} onToggle={onToggleFilter} showRules={gmEnabled} />
          ) : undefined
        }
        bodyClassName="gap-3"
        footer={
          <JournalComposer
            onLog={onLog}
            sessionOpen={sessionActive}
            sessionPaused={sessionPaused}
            gmEnabled={gmEnabled}
            onAskGm={onAskGm}
            onAskRules={onAskRules}
            campaignId={campaignId}
            ttsAvailable={ttsAvailable}
            seed={noteSeed}
          />
        }
      >
        {error && <ErrorBanner onRetry={onRetry}>{error}</ErrorBanner>}

        {(sessions === null || entries === null || characters === null || quests === null) && !error && (
          <SkeletonGroup label="Loading journal" className="gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SkeletonGroup>
        )}

        {sessions !== null && entries !== null && (
          <JournalFeed
            items={feedItems}
            sessions={sessions}
            filter={feedFilter}
            onSaveAsNote={sessionActive ? (item) => setNoteSeed({ body: item.body }) : undefined}
            aiVoiceOn={aiVoiceOn}
            onToggleAiVoice={onToggleAiVoice}
            onResolveCheck={onResolveCheck}
            resolvingCheckId={resolvingCheckId}
          />
        )}
      </ColumnCard>

      {/* RIGHT: Quest Log card — same shell, independent scroll. Slice 9
        * v2 (2026-08-10, owner's redirect from a separate World overlay):
        * NPCs/Factions/Treasure are three more tabs here rather than a
        * second click-to-open surface — `WorldTabs` owns the tab row and
        * the scrolling list as one self-contained unit; this card just
        * gives it a bounded height to fill. The header's old "N Quests"
        * count is gone rather than made tab-aware: it was a single-slot
        * `headerRight` the parent controls, and `WorldTabs` owns tab
        * state internally (see its own doc comment for why), so there's
        * no clean way for this card to know which tab is active without
        * lifting that state back out — not worth it for a count. Shown
        * whenever any of the four lists has loaded, not gated on quests
        * specifically being non-empty like the old quests-only panel
        * was — a campaign with NPCs but no quests yet should still see
        * this card. */}
      {quests !== null && npcs !== null && factions !== null && treasure !== null && notes !== null && (
        <ColumnCard headerLeft="Quest Log" bodyClassName="gap-0">
          <WorldTabs
            quests={quests}
            npcs={npcs}
            factions={factions}
            treasure={treasure}
            notes={notes}
            npcStatBlocks={npcStatBlocks}
            className="min-h-0 flex-1"
          />
        </ColumnCard>
      )}
    </div>
  )
}
