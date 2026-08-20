import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EncounterControls } from './EncounterControls'
import { InitiativeRing } from './InitiativeRing'
import { MonsterCard } from './MonsterCard'
import { useEncounterMonsters } from '../../hooks/useEncounterMonsters'
import {
  addEncounterMonster,
  advanceTurn,
  damageEncounterMonster,
  endEncounter,
  readCombatants,
  resolveMoraleCheck,
  rollInitiative,
  setMonsterVisibility,
  startEncounter,
} from '../../lib/encounters'
import type { Json } from '../../lib/database.types'
import type { TurnOrder } from '../../lib/encounters'

interface EncounterPanelProps {
  campaignId: string
  isOwner: boolean
  /** Threaded straight to `endEncounter` for its journal-summary echo —
   * `null` between sessions, same "works either way, just skips the log
   * line" convention every other command with an optional session takes
   * (`setCharacterHpMax`'s own doc comment). */
  sessionId: string | null
  /** Lifted to `JournalScreen` (not fetched locally the way
   * `encounter_monsters` is below) so `PlayerCard`'s active-turn ring
   * stays in sync outside this panel too — see `useCampaignRealtime`'s
   * own doc comment on why `turn_order` is the one encounter table
   * subscribed at the top level. */
  turnOrder: TurnOrder | null
  onTurnOrderChange: Dispatch<SetStateAction<TurnOrder | null>>
  onError: (message: string) => void
}

/**
 * Encounter mode phase 2 (BUILD_PLAN.md item 13) — monsters + initiative
 * + turn order UI, mounted inside `MapsSceneTab` per the scope doc's
 * decision #3 ("turn tracker home"). Orchestrates `EncounterControls`
 * (GM transport), `InitiativeRing` (turn order strip), and a
 * `MonsterCard` per monster — this file owns the RPC calls and loading
 * state, those three own their own rendering (CLAUDE.md's ~300-line cap).
 *
 * `encounter_monsters` is fetched + subscribed locally via
 * `useEncounterMonsters` (this panel's own scoped lifecycle, matching
 * `scene_positions`' own reasoning for staying un-lifted) — `turn_order`
 * is NOT: it arrives as a prop, already lifted to `JournalScreen` so
 * `PlayerCard`'s active-turn ring works outside this panel too.
 *
 * The GM-only add-monster form and every mutation control below are
 * gated on `isOwner` — a non-owner player still sees the live turn order
 * and whatever monsters RLS let through (`visible_to_players` rows),
 * read-only, matching `MonsterCard`'s own "everyone who can see the row
 * sees the same detail" reasoning.
 */
export function EncounterPanel({ campaignId, isOwner, sessionId, turnOrder, onTurnOrderChange, onError }: EncounterPanelProps) {
  const [monsters, setMonsters] = useEncounterMonsters(campaignId)
  const [starting, setStarting] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [busyMonsterId, setBusyMonsterId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [monsterLabel, setMonsterLabel] = useState('')
  const [monsterHpMax, setMonsterHpMax] = useState('')
  const [monsterAc, setMonsterAc] = useState('')

  const encounterOpen = turnOrder !== null
  const combatants = turnOrder ? readCombatants(turnOrder.combatants) : []

  async function handleStart() {
    setStarting(true)
    try {
      onTurnOrderChange(await startEncounter(campaignId))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start the encounter.')
    } finally {
      setStarting(false)
    }
  }

  async function handleRoll() {
    setRolling(true)
    try {
      onTurnOrderChange(await rollInitiative(campaignId))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not roll initiative.')
    } finally {
      setRolling(false)
    }
  }

  async function handleAdvance() {
    setAdvancing(true)
    try {
      onTurnOrderChange(await advanceTurn(campaignId))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not advance the turn.')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleEnd() {
    setEnding(true)
    try {
      await endEncounter(campaignId, sessionId)
      onTurnOrderChange(null)
      setMonsters([])
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not end the encounter.')
    } finally {
      setEnding(false)
    }
  }

  async function handleAddMonster() {
    setAdding(true)
    try {
      const hpMax = monsterHpMax.trim() === '' ? undefined : Number(monsterHpMax)
      const created = await addEncounterMonster(campaignId, {
        label: monsterLabel,
        statBlock: {
          ...(hpMax != null && { hp_max: hpMax, hp_current: hpMax }),
          ...(monsterAc.trim() !== '' && { ac: Number(monsterAc) }),
        },
      })
      setMonsters((prev) => [...(prev ?? []), created])
      setMonsterLabel('')
      setMonsterHpMax('')
      setMonsterAc('')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add that monster.')
    } finally {
      setAdding(false)
    }
  }

  async function handleDamage(monsterId: string, delta: number) {
    setBusyMonsterId(monsterId)
    try {
      const updated = await damageEncounterMonster(monsterId, delta)
      setMonsters((prev) => (prev ?? []).map((monster) => (monster.id === updated.id ? updated : monster)))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update that monster.')
    } finally {
      setBusyMonsterId(null)
    }
  }

  async function handleToggleVisibility(monsterId: string, input: { visibleToPlayers?: boolean; hpVisibleToPlayers?: boolean }) {
    setBusyMonsterId(monsterId)
    try {
      const updated = await setMonsterVisibility(monsterId, input)
      setMonsters((prev) => (prev ?? []).map((monster) => (monster.id === updated.id ? updated : monster)))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update that monster.')
    } finally {
      setBusyMonsterId(null)
    }
  }

  /** Encounter mode phase 3 (migration 0035) — `resolve_morale_check`
   * itself already deletes the monster's row and pulls it out of
   * `turn_order.combatants` server-side when it fails; this just brings
   * that same outcome into the two pieces of local/lifted state this
   * panel already owns, same "echo what the RPC returned" pattern every
   * other handler above uses. A held check (`fled: false`) touches
   * neither — the monster's row genuinely didn't change. */
  async function handleMoraleCheck(monsterId: string, wisMod: number) {
    setBusyMonsterId(monsterId)
    try {
      const result = await resolveMoraleCheck(monsterId, wisMod, sessionId)
      if (result.fled) {
        setMonsters((prev) => (prev ?? []).filter((monster) => monster.id !== monsterId))
        onTurnOrderChange((prev) =>
          prev
            ? {
                ...prev,
                combatants: readCombatants(prev.combatants).filter(
                  (combatant) => combatant.combatant_id !== monsterId,
                ) as unknown as Json,
              }
            : prev,
        )
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not resolve the morale check.')
    } finally {
      setBusyMonsterId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
      <p className={cx(text.caption, 'uppercase tracking-eyebrow text-ink-faint')}>Encounter</p>

      {isOwner ? (
        <EncounterControls
          encounterOpen={encounterOpen}
          hasCombatants={combatants.length > 0}
          starting={starting}
          rolling={rolling}
          advancing={advancing}
          ending={ending}
          onStart={() => void handleStart()}
          onRoll={() => void handleRoll()}
          onAdvance={() => void handleAdvance()}
          onEnd={() => void handleEnd()}
        />
      ) : (
        !encounterOpen && <p className={cx(text.caption, 'text-ink-faint')}>No encounter running.</p>
      )}

      {turnOrder && (
        <>
          <InitiativeRing combatants={combatants} activeIndex={turnOrder.active_index} roundNumber={turnOrder.round_number} />

          {isOwner && (
            <div className="flex flex-wrap items-end gap-2">
              <TextInput label="Monster" value={monsterLabel} onChange={(event) => setMonsterLabel(event.target.value)} className="flex-1" />
              <TextInput
                label="HP"
                type="number"
                inputMode="numeric"
                value={monsterHpMax}
                onChange={(event) => setMonsterHpMax(event.target.value)}
                className="w-20"
              />
              <TextInput
                label="AC"
                type="number"
                inputMode="numeric"
                value={monsterAc}
                onChange={(event) => setMonsterAc(event.target.value)}
                className="w-20"
              />
              <Button type="button" variant="ghost" disabled={adding || monsterLabel.trim() === ''} onClick={() => void handleAddMonster()}>
                Add
              </Button>
            </div>
          )}

          {monsters && monsters.length > 0 && (
            <div className="flex flex-col gap-2">
              {monsters.map((monster) => (
                <MonsterCard
                  key={monster.id}
                  monster={monster}
                  isOwner={isOwner}
                  busy={busyMonsterId === monster.id}
                  onDamage={(delta) => void handleDamage(monster.id, delta)}
                  onToggleVisibility={(input) => void handleToggleVisibility(monster.id, input)}
                  onMoraleCheck={(wisMod) => void handleMoraleCheck(monster.id, wisMod)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
