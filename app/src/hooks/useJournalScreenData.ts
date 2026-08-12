import { useCallback, useEffect, useState } from 'react'
import { getMyMembership, listJournalEntries, listSessions } from '../lib/campaigns'
import type { CampaignMember, CampaignSession, JournalEntry } from '../lib/campaigns'
import { listCharacters } from '../lib/characters'
import type { Character } from '../lib/characters'
import { listQuests } from '../lib/quests'
import type { Quest } from '../lib/quests'
import { listCampaignNotes, listFactions, listLocationSecrets, listLocations, listNpcStatBlocks, listNpcs, listTreasure } from '../lib/world'
import type { Faction, Location, LocationSecret, Note, Npc, NpcStatBlock, Treasure } from '../lib/world'

/**
 * `JournalScreen`'s core data fetch — sessions, entries, characters,
 * quests, loaded together on mount and reloadable via `load()` (the
 * ErrorBanner retry path calls it). Split out of `JournalScreen.tsx` —
 * BOB_fixes.md's follow-up cut: the recommended desktop-layout
 * extraction alone brought that file to 401 lines, still over
 * CLAUDE.md's ~300-line cap (it had grown past the ~390 that
 * recommendation was sized against). Pure state + effect, moved
 * verbatim; no behavior change from what `JournalScreen` did inline.
 *
 * `useCallback` on `load` so the mount effect can honestly list it as a
 * dependency (`react-hooks/exhaustive-deps` runs at `--max-warnings=0`
 * in `verify`); the effect itself needs a targeted
 * `react-hooks/set-state-in-effect` opt-out because that rule flags any
 * setState reachable from an effect-called function even past an
 * `await`, which it doesn't model.
 *
 * `npcs`/`factions`/`treasure`/`npcStatBlocks` added for BUILD_PLAN.md
 * slice 9 (`WorldTabs`) — loaded alongside everything else here rather
 * than lazily on first tab-open, since the Quest Log column is always
 * visible (not opened on demand the way Maps/RulesChat are), so there's
 * no "hasn't been opened yet" moment to defer the fetch to.
 * `npcStatBlocks` is a `Map<npc_id, NpcStatBlock>` built from
 * `listNpcStatBlocks`'s array return — `WorldTabs`/`NpcCard` want O(1)
 * lookup per NPC row, not a linear `.find()` per card.
 *
 * `notes` (2026-08-10, `WorldTabs`' 5th tab) follows the same
 * load-everything-up-front reasoning as the other three.
 *
 * `myMembership` (2026-08-11, join-by-code + character-ownership pass)
 * follows the same reasoning again: `JournalScreen` needs the caller's
 * own `campaign_members.id` to tell "my character" apart from "a
 * character" (see its own doc comment on `myCharacter`), and this
 * screen already owns the one parallel load everything else here goes
 * through. Not partitioned into its own hook — one more `Promise.all`
 * entry costs nothing extra over a second effect/fetch cycle.
 */
export function useJournalScreenData(campaignId: string) {
  const [sessions, setSessions] = useState<CampaignSession[] | null>(null)
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [npcs, setNpcs] = useState<Npc[] | null>(null)
  const [factions, setFactions] = useState<Faction[] | null>(null)
  const [treasure, setTreasure] = useState<Treasure[] | null>(null)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [npcStatBlocks, setNpcStatBlocks] = useState<Map<string, NpcStatBlock>>(new Map())
  // Locations tracker (BUILD_PLAN.md item 15 slice 1) — same
  // Map<location_id, LocationSecret> shape and same RLS-driven "empty
  // for a player, real rows for the GM" ambiguity as npcStatBlocks
  // above; see listLocationSecrets' own doc comment.
  const [locationSecrets, setLocationSecrets] = useState<Map<string, LocationSecret>>(new Map())
  const [myMembership, setMyMembership] = useState<CampaignMember | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [
        sessionRows,
        entryRows,
        characterRows,
        questRows,
        npcRows,
        factionRows,
        treasureRows,
        noteRows,
        locationRows,
        statBlockRows,
        locationSecretRows,
        membership,
      ] = await Promise.all([
        listSessions(campaignId),
        listJournalEntries(campaignId),
        listCharacters(campaignId),
        listQuests(campaignId),
        listNpcs(campaignId),
        listFactions(campaignId),
        listTreasure(campaignId),
        listCampaignNotes(campaignId),
        listLocations(campaignId),
        listNpcStatBlocks(campaignId),
        listLocationSecrets(campaignId),
        getMyMembership(campaignId),
      ])
      setSessions(sessionRows)
      setEntries(entryRows)
      setCharacters(characterRows)
      setQuests(questRows)
      setNpcs(npcRows)
      setFactions(factionRows)
      setTreasure(treasureRows)
      setNotes(noteRows)
      setLocations(locationRows)
      setNpcStatBlocks(new Map(statBlockRows.map((row) => [row.npc_id, row])))
      setLocationSecrets(new Map(locationSecretRows.map((row) => [row.location_id, row])))
      setMyMembership(membership)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading the journal.')
    }
  }, [campaignId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return {
    sessions, setSessions,
    entries, setEntries,
    characters, setCharacters,
    quests, setQuests,
    npcs, factions, treasure, notes, locations, npcStatBlocks, locationSecrets,
    myMembership,
    error, setError,
    load,
  }
}
