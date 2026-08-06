import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { readCharacterAbilities } from '../../lib/characters'
import type { Character, CharacterAbilities } from '../../lib/characters'
import { formatRollText } from '../../lib/dice'
import type { DieType, DiceRollResult, RollMode, RollModifier } from '../../lib/dice'

const DIE_OPTIONS: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
const MAX_COUNT = 10

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
 * Not built on the style guide's `DiceResult` component: that one
 * models a single die's raw face for crit/fumble styling, which doesn't
 * fit multi-die sums or advantage/disadvantage's "kept" set (there's no
 * single "face" to crit-check when two dice are summed). Its two-tier
 * label/total/breakdown layout is reused here by hand instead.
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
    try {
      setResult(await onRoll(die, count, mode))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not roll.')
    } finally {
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

  const total = result ? result.total + (activeModifier?.value ?? 0) : null
  const notation = result
    ? result.mode === 'normal'
      ? result.count > 1
        ? `${result.count}${result.die}`
        : result.die
      : `${result.count * 2}${result.die} kept`
    : null

  return (
    <Overlay open={open} onClose={handleClose} width="narrow" header={<h2 className={text.h2}>Roll</h2>}>
      <div className="flex flex-col gap-5">
        <div>
          <p className={cx(text.label, 'mb-2')}>Die</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Die">
            {DIE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={die === option}
                onClick={() => {
                  setDie(option)
                  clearResult()
                }}
                className={chipClass(die === option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={cx(text.label, 'mb-2')}>Count</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCount((prev) => Math.max(1, prev - 1))
                clearResult()
              }}
              disabled={count <= 1}
              className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel2 text-ink hover:border-line-hover',
                count <= 1 && 'pointer-events-none opacity-40',
              )}
              aria-label="Fewer dice"
            >
              −
            </button>
            <span className={cx(text.numeric, 'w-6 text-center')}>{count}</span>
            <button
              type="button"
              onClick={() => {
                setCount((prev) => Math.min(MAX_COUNT, prev + 1))
                clearResult()
              }}
              disabled={count >= MAX_COUNT}
              className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel2 text-ink hover:border-line-hover',
                count >= MAX_COUNT && 'pointer-events-none opacity-40',
              )}
              aria-label="More dice"
            >
              +
            </button>
          </div>
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

        {result && total !== null && (
          <div className="flex flex-col items-center gap-1 rounded-card border border-line-soft bg-panel2 px-4 py-4 text-center">
            <span className={text.label}>{notation}</span>
            <span className={text.dataDisplay}>{total}</span>
            <span className={text.bodySecondary}>{formatRollText(result, activeModifier)}</span>
          </div>
        )}

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
