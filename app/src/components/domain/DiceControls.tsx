import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { TextInput } from '../ui/TextInput'
import { Stepper } from '../ui/Stepper'
import { DieSelector } from './DieSelector'
import type { CharacterAbilities } from '../../lib/characters'
import type { DieType, RollMode } from '../../lib/dice'

const MAX_COUNT = 10

/** `short` is what actually renders — `label` stays the full word for
 * `aria-label` only. Measured against the Stepper it shares a row
 * with: Stepper's two 44px touch-target buttons plus its number readout
 * come to ~136px on their own (not shrinking that — it's the shared
 * component SPEC's touch-target minimum owns), which leaves too little
 * of a narrow sheet's width for "Disadvantage" spelled out next to it.
 * "Normal" stays full — it's the shortest of the three and the
 * default, worth keeping unambiguous. */
const MODE_OPTIONS: Array<{ mode: RollMode; label: string; short: string }> = [
  { mode: 'disadvantage', label: 'Disadvantage', short: 'Dis' },
  { mode: 'normal', label: 'Normal', short: 'Normal' },
  { mode: 'advantage', label: 'Advantage', short: 'Adv' },
]

const ABILITY_ORDER: Array<{ key: keyof CharacterAbilities; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

/** What's currently supplying the roll's modifier — exported so
 * `DiceRoller` can type the state it owns (this component renders the
 * picker; `DiceRoller` still owns which one is selected, same
 * ownership split `RecentRoll` already establishes for `RecentRolls`). */
export type ModifierSource =
  | { kind: 'none' }
  | { kind: 'ability'; key: keyof CharacterAbilities; label: string; value: number }
  | { kind: 'custom' }

const chipClass = (active: boolean) =>
  cx(
    'inline-flex items-center justify-center rounded-full border px-3 py-1 uppercase',
    text.caption,
    active ? 'border-purple bg-purple text-white' : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
  )

interface DiceControlsProps {
  die: DieType
  onDieChange: (die: DieType) => void
  count: number
  onCountChange: (count: number) => void
  mode: RollMode
  onModeChange: (mode: RollMode) => void
  abilities: CharacterAbilities
  modifierSource: ModifierSource
  onModifierSourceChange: (source: ModifierSource) => void
  customModifier: string
  onCustomModifierChange: (value: string) => void
}

/**
 * The Die/Count/Mode/Modifier control block — split out of
 * `DiceRoller.tsx` (BOB_fixes.md's follow-up cut: that file was 447
 * lines, over CLAUDE.md's ~300-line cap; `RollResult.tsx` and
 * `RecentRolls.tsx` were already split out the same way in earlier
 * passes, this follows their precedent for the one piece that was
 * still inlined). Extraction only, not a redesign — every className,
 * every comment explaining a specific owner-directed layout decision,
 * and every "does this clear the current result" behavior moved
 * verbatim. As of commit `1942650`, the owner is happy with this
 * screen's behavior; nothing here may change a frame of it.
 *
 * Deliberately has no idea `clearResult()` exists. Changing the die,
 * count, or mode invalidates the last roll's preview in the real app —
 * but that's a `DiceRoller`-owned side effect the caller bakes into
 * `onDieChange`/`onCountChange`/`onModeChange` themselves (passing
 * `(next) => { setDie(next); clearResult() }`, not just `setDie`).
 * Changing the *modifier* deliberately does NOT clear the result — a
 * modifier is applied client-side on top of already-rolled dice
 * (`RollResult`'s own `total = result.total + modifier.value`), so
 * `onModifierSourceChange`/`onCustomModifierChange` are passed straight
 * through with no such wrapping. This component doesn't know or care
 * about that asymmetry; it only calls the callbacks it's given.
 */
export function DiceControls({
  die,
  onDieChange,
  count,
  onCountChange,
  mode,
  onModeChange,
  abilities,
  modifierSource,
  onModifierSourceChange,
  customModifier,
  onCustomModifierChange,
}: DiceControlsProps) {
  return (
    <>
      <div>
        <p className={cx(text.label, 'mb-2')}>Die</p>
        {/* No `justify-center` here (every other control on this sheet
         * gets one) — `DieSelector` scrolls horizontally now, and
         * centering a row that overflows its container pushes content
         * off BOTH edges symmetrically, meaning the row would open
         * scrolled to its middle instead of starting at d4 the way a
         * scrollable strip should. */}
        <DieSelector value={die} onChange={onDieChange} />
      </div>

      {/* Count and Mode are both compact controls (a three-button
       * stepper; a three-segment pill) with nothing else competing for
       * width on the same line, so they share a row instead of each
       * claiming a full-width block of vertical space — owner's
       * layout pass. `flex-wrap` is safety, not the intended state:
       * on any sheet width both should fit on one line, but a phone
       * narrow enough to force a wrap still gets two clean stacked
       * rows instead of a clipped one. `gap-4` (16px, "component" on
       * the closed scale) rather than the sheet's usual `gap-6` — the
       * two controls in this one row need to actually fit, and this
       * pair reads as one related unit rather than two "separated"
       * (24px-slot) blocks anyway. */}
      <div className="flex flex-wrap items-start justify-center gap-4">
        <div>
          <p className={cx(text.label, 'mb-2')}>Count</p>
          <Stepper value={count} onChange={onCountChange} max={MAX_COUNT} label="dice" className="justify-center" />
        </div>

        <div>
          <p className={cx(text.label, 'mb-2')}>Mode</p>
          {/* One bordered pill, internally divided — replaces three
           * separately bordered chips (reference mockup: a single
           * segmented Disadvantage/Normal/Advantage control, not three
           * standalone buttons). One shared `border` on the outer pill
           * plus `p-1` padding means the segments themselves need no
           * border of their own, so there's no seam to manage between
           * them. `px-2 py-1` rather than Modifier's `px-3 py-1` — the
           * same "compact-pill exception" JournalFilterBar's own
           * header comment already invokes (reused from the
           * composer's kind-chip sizing rather than the 44px touch
           * target every primary control gets), pushed one step
           * further here since this control now shares a row with
           * Count instead of owning the sheet's full width. */}
          <div
            className="inline-flex rounded-button border border-line-soft bg-panel2 p-1"
            role="radiogroup"
            aria-label="Mode"
          >
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={mode === option.mode}
                aria-label={option.label}
                onClick={() => onModeChange(option.mode)}
                className={cx(
                  'rounded-button px-2 py-1 uppercase transition-colors',
                  text.caption,
                  mode === option.mode ? 'bg-purple text-white' : 'text-ink-dim hover:text-ink',
                )}
              >
                {option.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className={cx(text.label, 'mb-2')}>Modifier</p>
        <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Modifier">
          <button
            type="button"
            role="radio"
            aria-checked={modifierSource.kind === 'none'}
            onClick={() => onModifierSourceChange({ kind: 'none' })}
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
                onClick={() => onModifierSourceChange({ kind: 'ability', key, label: `${label} Modifier`, value: score.mod })}
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
            onClick={() => onModifierSourceChange({ kind: 'custom' })}
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
            onChange={(event: { target: { value: string } }) => onCustomModifierChange(event.target.value)}
            placeholder="e.g. 2 or -1"
            className="mx-auto mt-2 w-32"
            aria-label="Custom modifier"
          />
        )}
      </div>
    </>
  )
}
