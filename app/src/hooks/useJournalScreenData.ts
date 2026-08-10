import { useCallback, useEffect, useState } from 'react'
import { listJournalEntries, listSessions } from '../lib/campaigns'
import type { CampaignSession, JournalEntry } from '../lib/campaigns'
import { listCharacters } from '../lib/characters'
import type { Character } from '../lib/characters'
import { listQuests } from '../lib/quests'
import type { Quest } from '../lib/quests'
import { listCampaignNotes, listFactions, listNpcStatBlocks, listNpcs, listTreasure } from '../lib/world'
import type { Faction, Note, Npc, NpcStatBlock, Treasure } from '../lib/world'

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
  const [npcStatBlocks, setNpcStatBlocks] = useState<Map<string, NpcStatBlock>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sessionRows, entryRows, characterRows, questRows, npcRows, factionRows, treasureRows, noteRows, statBlockRows] =
        await Promise.all([
          listSessions(campaignId),
          listJournalEntries(campaignId),
          listCharacters(campaignId),
          listQuests(campaignId),
          listNpcs(campaignId),
          listFactions(campaignId),
          listTreasure(campaignId),
          listCampaignNotes(campaignId),
          listNpcStatBlocks(campaignId),
        ])
      setSessions(sessionRows)
      setEntries(entryRows)
      setCharacters(characterRows)
      setQuests(questRows)
      setNpcs(npcRows)
      setFactions(factionRows)
      setTreasure(treasureRows)
      setNotes(noteRows)
      setNpcStatBlocks(new Map(statBlockRows.map((row) => [row.npc_id, row])))
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
    npcs, factions, treasure, notes, npcStatBlocks,
    error, setError,
    load,
  }
}
