import { useCallback, useEffect, useState } from 'react'
import { listJournalEntries, listSessions } from '../lib/campaigns'
import type { CampaignSession, JournalEntry } from '../lib/campaigns'
import { listCharacters } from '../lib/characters'
import type { Character } from '../lib/characters'
import { listQuests } from '../lib/quests'
import type { Quest } from '../lib/quests'

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
 */
export function useJournalScreenData(campaignId: string) {
  const [sessions, setSessions] = useState<CampaignSession[] | null>(null)
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sessionRows, entryRows, characterRows, questRows] = await Promise.all([
        listSessions(campaignId),
        listJournalEntries(campaignId),
        listCharacters(campaignId),
        listQuests(campaignId),
      ])
      setSessions(sessionRows)
      setEntries(entryRows)
      setCharacters(characterRows)
      setQuests(questRows)
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
    error, setError,
    load,
  }
}
