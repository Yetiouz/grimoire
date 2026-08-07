import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { Stepper } from '../ui/Stepper'
import { DieSelector } from './DieSelector'
import { RollResult } from './RollResult'
import { readCharacterAbilities } from '../../lib/characters'
import type { Character, CharacterAbilities } from '../../lib/characters'
import { formatRollText } from '../../lib/dice'
import type { DieType, DiceRollResult, RollMode, RollModifier } from '../../lib/dice'

const FACES: Record<DieType, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }
const MAX_COUNT = 10
/** Roll always takes at least this long, even when the RPC round-trip is
 * faster — otherwise RollResult's tumble animation would sometimes
 * flash for a single frame instead of reading as an actual roll. */
const MIN_ROLL_MS = 650

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MODE_OPTIONS: Array<{ mode: RollMode; label: string }> = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'advantage', label: 'Advantage' },
  { mode: 'disadvantage', label: 'Disadvantage' },
]

const ABILITY_ORDER: Array<{ key: keyof CharacterAbilities; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

type ModifierSource = { kind: 'none' } | { kind: 'ability'; key: keyof CharacterAbilities; label: string; value: number } | { kind: 'custom' }

interface DiceRollerProps {
  open: boolean
  onClose: () => void
  /** Source for the ability-modifier chips (STR Modifier, DEX Modifier,
   * etc.) — the same active party PC JournalScreen already tracks for
   * actor color. Null just means those chips don't render; "None" and
   * "Custom" are always available regardless. Confirmed with the user:
   * modifiers are sourced from the real character sheet from the start,
   * not added later, so beginners can roll and immediately see e.g.
   * "10 + 2 (STR Modifier)" without doing the math themselves. */
  character: Character | null
  onRoll: (die: DieType, count: number, mode: RollMode) => Promise<DiceRollResult>
  onLog: (body: string) => Promise<void>
}

const chipClass = (active: boolean) =>
  cx(
    'inline-flex items-center justify-center rounded-full border px-3 py-1 uppercase',
    text.caption,
    active ? 'border-purple bg-purple text-white' : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
  )

/**
 * The app-rolled half of dice (BUILD_PLAN.md slice 4: server-
 * authoritative dice). The hand-rolled half — someone rolling real dice
 * and typing the result into the journal — already exists as
 * JournalComposer's "Roll" kind chip and is deliberately left untouched
 * here: confirmed with the user ("some people like rolling real dice"),
 * that path stays exactly as it is.
 *
 * Doesn't call Supabase itself — `onRoll`/`onLog` are owned by
 * JournalScreen, same component-boundary rule CharacterSheet and
 * PlayerCard already follow (SPEC's "Shared components rule").
 *
 * Split into three files in the retroactive-review pass (this file was
 * 367 lines, over CLAUDE.md's ~300-line cap): `DieSelector.tsx` (the
 * die-shape chip row) and `RollResult.tsx` (the roll preview card, also
 * BUILD_PLAN.md's own named `RollResult` domain component) each own
 * their rendering; this file keeps the controls (count/mode/modifier)
 * and all the roll/log orchestration.
 */
export function DiceRoller({ open, onClose, character, onRoll, onLog }: DiceRollerProps) {
  const [die, setDie] = useState<DieType>('d20')
  const [count, setCount] = useState(1)
  const [mode, setMode] = useState<RollMode>('normal')
  const [modifierSource, setModifierSource] = useState<ModifierSource>({ kind: 'none' })
  const [customModifier, setCustomModifier] = useState('')
  const [result, setResult] = useState<DiceRollResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Rapid-cycling stand-in total shown only while `rolling` is true —
   * pure visual flourish (a "slot reel" flicker), never the value that
   * gets logged; the real total always comes from `result`, which is
   * server-authoritative. */
  const [flickerTotal, setFlickerTotal] = useState<number | null>(null)

  const abilities = character ? readCharacterAbilities(character.abilities) : {}

  const activeModifier: RollModifier | undefined =
    modifierSource.kind === 'ability'
      ? { value: modifierSource.value, label: modifierSource.label }
      : modifierSource.kind === 'custom' && customModifier.trim() !== '' && !Number.isNaN(Number(customModifier))
        ? { value: Number(customModifier), label: 'Custom' }
        : undefined

  // Any option change invalidates the last roll's preview rather than
  // leaving a result on screen that no longer matches what's selected.
  function clearResult() {
    setResult(null)
    setError(null)
  }

  function handleClose() {
    clearResult()
    onClose()
  }

  async function handleRoll() {
    setRolling(true)
    setError(null)
    setResult(null)
    const faces = FACES[die]
    // Flicker a random plausible total every 80ms while the real roll is
    // in flight — same idea as a slot machine's reel, purely cosmetic.
    const flickerId = setInterval(() => {
      setFlickerTotal(Math.floor(Math.random() * (faces * count - count + 1)) + count)
    }, 80)
    try {
      const [rolled] = await Promise.all([onRoll(die, count, mode), sleep(MIN_ROLL_MS)])
      setResult(rolled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not roll.')
    } finally {
      clearInterval(flickerId)
      setFlickerTotal(null)
      setRolling(false)
    }
  }

  async function handleLog() {
    if (!result) return
    setLogging(true)
    try {
      await onLog(formatRollText(result, activeModifier))
      clearResult()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the roll.')
    } finally {
      setLogging(false)
    }
  }

  return (
    <Overlay open={open} onClose={handleClose} width="narrow" variant="sheet" header={<h2 className={text.h2}>Roll</h2>}>
      {/* gap-6 (retroactive-review fix: was gap-5, 20px, not on the
       * closed 4/8/12/16/24/32/48/64 spacing scale — 24px is the
       * scale's "separated" slot, which is exactly what this is: the
       * distinct Die/Count/Mode/Modifier/Result/Buttons blocks on one
       * screen). */}
      <div className="flex flex-col gap-6">
        <div>
          <p className={cx(text.label, 'mb-2')}>Die</p>
          <DieSelector
            value={die}
            onChange={(next) => {
              setDie(next)
              clearResult()
            }}
          />
        </div>

        <div>
          <p className={cx(text.label, 'mb-2')}>Count</p>
          <Stepper
            value={count}
            onChange={(next) => {
              setCount(next)
              clearResult()
            }}
            max={MAX_COUNT}
            label="dice"
          />
        </div>

        <div>
          <p className={cx(text.label, 'mb-2')}>Mode</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={mode === option.mode}
                onClick={() => {
                  setMode(option.mode)
                  clearResult()
                }}
                className={chipClass(mode === option.mode)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={cx(text.label, 'mb-2')}>Modifier</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modifier">
            <button
              type="button"
              role="radio"
              aria-checked={modifierSource.kind === 'none'}
              onClick={() => setModifierSource({ kind: 'none' })}
              className={chipClass(modifierSource.kind === 'none')}
            >
              None
            </button>
            {ABILITY_ORDER.map(({ key, label }) => {
              const score = abilities[key]
              if (!score) return null
              const active = modifierSource.kind === 'ability' && modifierSource.key === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setModifierSource({ kind: 'ability', key, label: `${label} Modifier`, value: score.mod })}
                  className={chipClass(active)}
                >
                  {label}
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={modifierSource.kind === 'custom'}
              onClick={() => setModifierSource({ kind: 'custom' })}
              className={chipClass(modifierSource.kind === 'custom')}
            >
              Custom
            </button>
          </div>
          {modifierSource.kind === 'custom' && (
            <TextInput
              type="number"
              inputMode="numeric"
              value={customModifier}
              onChange={(event: { target: { value: string } }) => setCustomModifier(event.target.value)}
              placeholder="e.g. 2 or -1"
              className="mt-2 w-32"
              aria-label="Custom modifier"
            />
          )}
        </div>

        {error && <p className={cx(text.caption, 'text-red')}>{error}</p>}

        <RollResult rolling={rolling} die={die} result={result} modifier={activeModifier} flickerTotal={flickerTotal} />

        <div className="flex gap-2">
          <Button onClick={() => void handleRoll()} disabled={rolling} className="flex-1">
            {rolling ? 'Rolling…' : result ? 'Roll Again' : 'Roll'}
          </Button>
          {result && (
            <Button variant="ghost" onClick={() => void handleLog()} disabled={logging} className="flex-1">
              {logging ? 'Logging…' : 'Log'}
            </Button>
          )}
        </div>
      </div>
    </Overlay>
  )
}
