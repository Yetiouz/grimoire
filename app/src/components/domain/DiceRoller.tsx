import { useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { Stepper } from '../ui/Stepper'
import { DieSelector } from './DieSelector'
import { RollResult } from './RollResult'
import { RecentRolls } from './RecentRolls'
import type { RecentRoll } from './RecentRolls'
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
/** RecentRolls itself caps what it displays, but there's no reason for
 * this component to keep accumulating unbounded state behind that
 * window across a long session — trimmed here, at the source. */
const MAX_RECENT_ROLLS = 5

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** `short` is what actually renders — `label` stays the full word for
 * `aria-label` only. Measured against the Stepper it now shares a row
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
 * and all the roll/log orchestration. `RecentRolls.tsx` was split out
 * the same way rather than grown here, for the same reason.
 *
 * Reference pass (owner pointed at a mobile attack-roll mockup — "keep
 * our style, the layout and ideas are good"): the Mode control is now
 * one segmented three-way control instead of three individually
 * bordered chips (matching the mockup's pill), and a session-local
 * "Recent rolls" log becomes reachable — via its own button, opening as
 * a second overlay window rather than sitting inline — once at least one
 * roll has happened this time the sheet is open. Deliberately NOT
 * adopted from that mockup: weapon selection, a Target AC field, and
 * Hit/Miss/Crit resolution — this tool has no weapon/attack data model
 * to draw those from, and adding one is new scope, not a restyle.
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
  const [recentRolls, setRecentRolls] = useState<RecentRoll[]>([])
  /** Monotonic id source for RecentRolls' React keys — see that file's
   * own header comment for why index-based keys would be wrong here. */
  const nextRollId = useRef(0)
  /** Whether the Recent Rolls window (its own nested `Overlay`, opened
   * from a button rather than living inline) is open — owner's fourth
   * round: "put the recent rolls behind a button so you hit recent
   * rolls and it pulls it up in its own window." */
  const [recentRollsOpen, setRecentRollsOpen] = useState(false)

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
    // This is the outer sheet's Overlay's own onClose — fired by both
    // Escape and an outer-backdrop click. `Overlay` has no notion of
    // "topmost" overlay (each instance's Escape listener is a plain
    // `document` keydown handler, independent of nesting), so with the
    // Recent Rolls window open on top, an unguarded Escape would fire
    // both handlers at once and close the entire sheet out from under
    // it instead of just stepping back one level. Closing the nested
    // window first — and stopping there — makes Escape/backdrop behave
    // the way a stacked modal should: one layer at a time.
    if (recentRollsOpen) {
      setRecentRollsOpen(false)
      return
    }
    clearResult()
    // Recent rolls deliberately does NOT reset here — see this
    // component's own header comment: it's a "what did I just roll"
    // scoreboard for the sheet being open, not tied to any one result,
    // so closing and reopening the sheet without a page reload still
    // shows it. It only ever grows from `handleRoll`.
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
      setRecentRolls((prev) => [
        { id: nextRollId.current++, result: rolled, modifier: activeModifier },
        ...prev,
      ].slice(0, MAX_RECENT_ROLLS))
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
      {/* Owner's mobile pass, second round — a real phone showed four
       * problems this pass fixes together: the die row was wrapping D100
       * onto its own orphaned line, the whole sheet scrolled longer than
       * it needed to, the result card sat below every control (a scroll
       * down just to see what you rolled), and Recent Rolls was growing
       * the page instead of scrolling in its own small window.
       * `DieSelector` now scrolls horizontally instead of wrapping (see
       * its own header comment for the sizing math), `RollResult` now
       * leads the column instead of trailing the Modifier row,
       * `RecentRolls` caps its own height with an internal scroll (see
       * that file), and `gap-4` (16px, "component" on the closed scale)
       * replaces the previous gap-6 (24px, "separated") to tighten the
       * whole column's vertical rhythm now that there's one more section
       * competing for the same screen.
       *
       * `items-center text-center` (owner's centering pass, round two —
       * the first round only centered `RollResult`, but every control
       * block below it was still a full-width, left-hugging section).
       * Making the column itself center its children collapses each
       * section `<div>` to its own content width so it sits centered as
       * a block, but that alone doesn't touch alignment *inside* each
       * section — `DieSelector`/`Stepper`'s own rows, and the Modifier
       * chip row here, default to left-packed content within whatever
       * box they end up with, so each of those also gets an explicit
       * `justify-center` (chip rows) or centered `className`
       * (DieSelector/Stepper, via their existing `className` prop
       * rather than baking centering into either shared component —
       * both are generic controls other screens could still want
       * left-aligned). The fixed-width custom-modifier input needs its
       * own `mx-auto` for the same reason: a block element with an
       * explicit width doesn't self-center just because its container
       * does. */}
      <div className="flex flex-col items-center gap-4 text-center">
        {/* `w-full`: the result card reads as a full-bleed card, not a
         * shrunk box, now that the column centers its children (shrink-
         * to-fit) instead of stretching them. Always mounted now (owner's
         * third round: "I want the animation window to always be there"),
         * with its own idle state for before the first roll — it no
         * longer needs a visibility gate here, so the sheet's height
         * doesn't jump the moment a result first lands. */}
        <RollResult
          rolling={rolling}
          die={die}
          result={result}
          modifier={activeModifier}
          flickerTotal={flickerTotal}
          className="w-full"
        />

        <div>
          <p className={cx(text.label, 'mb-2')}>Die</p>
          {/* No `justify-center` here (every other control on this sheet
           * gets one) — `DieSelector` scrolls horizontally now, and
           * centering a row that overflows its container pushes content
           * off BOTH edges symmetrically, meaning the row would open
           * scrolled to its middle instead of starting at d4 the way a
           * scrollable strip should. */}
          <DieSelector
            value={die}
            onChange={(next) => {
              setDie(next)
              clearResult()
            }}
          />
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
            <Stepper
              value={count}
              onChange={(next) => {
                setCount(next)
                clearResult()
              }}
              max={MAX_COUNT}
              label="dice"
              className="justify-center"
            />
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
                  onClick={() => {
                    setMode(option.mode)
                    clearResult()
                  }}
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
              className="mx-auto mt-2 w-32"
              aria-label="Custom modifier"
            />
          )}
        </div>

        {error && <p className={cx(text.caption, 'text-red')}>{error}</p>}

        {/* `w-full`: the Roll/Log buttons' own `flex-1` split only means
         * anything if their row has the full column width to divide. */}
        <div className="flex w-full gap-2">
          <Button onClick={() => void handleRoll()} disabled={rolling} className="flex-1">
            {rolling ? 'Rolling…' : result ? 'Roll Again' : 'Roll'}
          </Button>
          {result && (
            <Button variant="ghost" onClick={() => void handleLog()} disabled={logging} className="flex-1">
              {logging ? 'Logging…' : 'Log'}
            </Button>
          )}
        </div>

        {/* Trigger only exists once there's something to show — same
         * "no dead affordance" call the card version made when it
         * rendered nothing on an empty list, just as a button instead
         * of a whole card now. */}
        {recentRolls.length > 0 && (
          <Button variant="ghost" onClick={() => setRecentRollsOpen(true)} className="w-full">
            Recent Rolls · {recentRolls.length}
          </Button>
        )}
      </div>

      <RecentRolls open={recentRollsOpen} onClose={() => setRecentRollsOpen(false)} rolls={recentRolls} />
    </Overlay>
  )
}
