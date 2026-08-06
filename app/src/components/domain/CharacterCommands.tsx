import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { Stepper } from '../ui/Stepper'
import { TextInput } from '../ui/TextInput'
import { GearSlotGrid } from './GearSlotGrid'
import {
  adjustCharacterGold,
  adjustCharacterHp,
  adjustCharacterXp,
  addCharacterGear,
  readCharacterSheet,
  removeCharacterGear,
  restCharacter,
} from '../../lib/characters'
import type { Character } from '../../lib/characters'

interface CharacterCommandsProps {
  character: Character
  /** The campaign's currently open session, if any — threaded straight
   * through to every command as `p_session_id` so the mutation echoes a
   * `system`-kind journal entry (see 0009's header comment). Every
   * command still works with this null; it just logs nothing. */
  sessionId: string | null
  /** Called with the row a command's RPC returned — the host screen
   * echoes it into both the party rail and this open sheet, same "echo
   * what the RPC returned" pattern every other command in the app
   * already uses. */
  onUpdate: (updated: Character) => void
}

// Matches `CharacterSheet.tsx`'s own `sectionLabelClass` exactly —
// duplicated rather than imported cross-file (this component is mounted
// *inside* `CharacterSheet`, so importing back from it would be a
// circular import between the two) but kept byte-identical so "Edit"
// reads as the same kind of section head as Abilities/Talents/Spells
// above it, not a visually distinct one.
const sectionLabelClass = 'mt-12 mb-3 font-mono text-base font-semibold uppercase tracking-eyebrow text-purple first:mt-0'

const tintButtonClass = (color: 'green' | 'red' | 'purple') =>
  cx(
    'inline-flex h-11 items-center justify-center rounded-button border px-4 font-mono uppercase',
    text.caption,
    'disabled:pointer-events-none disabled:opacity-40',
    color === 'green' && 'border-green/45 bg-green/10 text-green',
    color === 'red' && 'border-red/45 bg-red/10 text-red',
    color === 'purple' && 'border-purple/45 bg-purple/10 text-purple',
  )

/**
 * The mutation half of the character sheet (BUILD_PLAN.md slice 6) —
 * HP/XP/gold adjust, gear add/remove, full rest, each a real
 * `SECURITY DEFINER` command call, never a local-only edit. Mounted at
 * the bottom of `CharacterSheet`'s overlay content, below the read-only
 * sections that slice 3 already built. One `pending`/`error` pair
 * covers every action here (only one can run at a time from one sheet),
 * same shape as `JournalScreen`'s own start/end-session handling.
 */
export function CharacterCommands({ character, sessionId, onUpdate }: CharacterCommandsProps) {
  const [hpAmount, setHpAmount] = useState(1)
  const [xpAmount, setXpAmount] = useState(1)
  const [goldGp, setGoldGp] = useState('')
  const [goldSp, setGoldSp] = useState('')
  const [goldCp, setGoldCp] = useState('')
  const [gearName, setGearName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const equipment = readCharacterSheet(character.sheet).equipment ?? []

  async function run(action: () => Promise<Character>) {
    setPending(true)
    setError(null)
    try {
      onUpdate(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That command failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={sectionLabelClass}>Edit</p>

      {error && <ErrorBanner onRetry={() => setError(null)}>{error}</ErrorBanner>}

      <div className="flex flex-wrap items-center gap-3">
        <span className={cx(text.label, 'w-12 text-ink-faint')}>HP</span>
        <Stepper value={hpAmount} onChange={setHpAmount} min={1} max={character.hp_max} label="amount" />
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterHp(character.id, -hpAmount, sessionId))}
          className={tintButtonClass('red')}
        >
          Damage
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterHp(character.id, hpAmount, sessionId))}
          className={tintButtonClass('green')}
        >
          Heal
        </button>
        <button
          type="button"
          disabled={pending || character.hp_current >= character.hp_max}
          onClick={() => void run(() => restCharacter(character.id, sessionId))}
          className={tintButtonClass('purple')}
          title="Restore HP to max"
        >
          Full Rest
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={cx(text.label, 'w-12 text-ink-faint')}>XP</span>
        <Stepper value={xpAmount} onChange={setXpAmount} min={1} max={999} label="amount" />
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterXp(character.id, -xpAmount, sessionId))}
          className={tintButtonClass('red')}
        >
          −XP
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => adjustCharacterXp(character.id, xpAmount, sessionId))}
          className={tintButtonClass('green')}
        >
          +XP
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <TextInput
          label="+/− GP"
          type="number"
          inputMode="numeric"
          value={goldGp}
          onChange={(event) => setGoldGp(event.target.value)}
          className="w-24"
        />
        <TextInput
          label="+/− SP"
          type="number"
          inputMode="numeric"
          value={goldSp}
          onChange={(event) => setGoldSp(event.target.value)}
          className="w-24"
        />
        <TextInput
          label="+/− CP"
          type="number"
          inputMode="numeric"
          value={goldCp}
          onChange={(event) => setGoldCp(event.target.value)}
          className="w-24"
        />
        <Button
          type="button"
          variant="ghost"
          disabled={pending || (!goldGp && !goldSp && !goldCp)}
          onClick={() =>
            void run(async () => {
              const updated = await adjustCharacterGold(
                character.id,
                { gp: Number(goldGp) || 0, sp: Number(goldSp) || 0, cp: Number(goldCp) || 0 },
                sessionId,
              )
              setGoldGp('')
              setGoldSp('')
              setGoldCp('')
              return updated
            })
          }
        >
          Apply
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={cx(text.label, 'text-ink-faint')}>
          Gear
          {character.gear_current != null && character.gear_max != null
            ? ` — ${character.gear_current} of ${character.gear_max} slots`
            : ''}
        </span>
        {equipment.length > 0 && (
          <GearSlotGrid
            items={equipment}
            onRemove={(index) => void run(() => removeCharacterGear(character.id, index, sessionId))}
            removeDisabled={pending}
          />
        )}
        <div className="flex items-end gap-2">
          <TextInput
            label="Add item"
            value={gearName}
            onChange={(event) => setGearName(event.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            disabled={pending || gearName.trim() === ''}
            onClick={() =>
              void run(async () => {
                const updated = await addCharacterGear(character.id, gearName, sessionId)
                setGearName('')
                return updated
              })
            }
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
