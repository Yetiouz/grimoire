import { useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { Button } from '../ui/Button'
import { DiceControls } from './DiceControls'
import type { ModifierSource } from './DiceControls'
import { RollResult } from './RollResult'
import { RecentRolls } from './RecentRolls'
import type { RecentRoll } from './RecentRolls'
import { readCharacterAbilities } from '../../lib/characters'
import type { Character } from '../../lib/characters'
import { formatRollText } from '../../lib/dice'
import type { DieType, DiceRollResult, RollMode, RollModifier } from '../../lib/dice'

const FACES: Record<DieType, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }
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
 * Split into four files across two passes (this file was 367 lines,
 * then 447, both over CLAUDE.md's ~300-line cap): `DieSelector.tsx`
 * (the die-shape chip row), `RollResult.tsx` (the roll preview card,
 * also BUILD_PLAN.md's own named `RollResult` domain component),
 * `RecentRolls.tsx` (the session scoreboard, now its own overlay
 * window), and `DiceControls.tsx` (BOB_fixes.md's follow-up cut: the
 * Die/Count/Mode/Modifier block, the one piece still inlined after the
 * first three splits) each own their rendering; this file keeps state
 * and all the roll/log orchestration.
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

        <DiceControls
          die={die}
          onDieChange={(next) => {
            setDie(next)
            clearResult()
          }}
          count={count}
          onCountChange={(next) => {
            setCount(next)
            clearResult()
          }}
          mode={mode}
          onModeChange={(next) => {
            setMode(next)
            clearResult()
          }}
          abilities={abilities}
          modifierSource={modifierSource}
          onModifierSourceChange={setModifierSource}
          customModifier={customModifier}
          onCustomModifierChange={setCustomModifier}
        />

        {error && <p className={cx(text.caption, 'text-red')}>{error}</p>}

        {/* `w-full`: the Roll/Log buttons' own `flex-1` split only means
         * anything if their row has the full column width to divide.
         * Log now always renders rather than mounting only once
         * `result` exists — same bounce this round's RollResult change
         * fixes: any control change clears `result` (see `clearResult`),
         * so an unmount-on-empty Log button was disappearing and
         * reappearing on every single roll, shrinking and regrowing
         * this row each time. Disabled instead of absent keeps the row
         * one constant height; there's nothing to log until a result
         * exists either way. */}
        <div className="flex w-full gap-2">
          <Button onClick={() => void handleRoll()} disabled={rolling} className="flex-1">
            {rolling ? 'Rolling…' : result ? 'Roll Again' : 'Roll'}
          </Button>
          <Button variant="ghost" onClick={() => void handleLog()} disabled={!result || logging} className="flex-1">
            {logging ? 'Logging…' : 'Log'}
          </Button>
        </div>

        {/* Always rendered, disabled until there's something to show —
         * owner's sixth round: "leave the recent rolls button there all
         * the time. I don't like this shifting in sizes all the time."
         * The original "no dead affordance" call (skip the button
         * entirely on an empty list) was the same instinct that made
         * the Log button disappear/reappear each roll, which got fixed
         * the same way above — disabled beats absent whenever mounting
         * conditionally would shift the column's height. */}
        <Button
          variant="ghost"
          onClick={() => setRecentRollsOpen(true)}
          disabled={recentRolls.length === 0}
          className="w-full"
        >
          {recentRolls.length > 0 ? `Recent Rolls · ${recentRolls.length}` : 'Recent Rolls'}
        </Button>
      </div>

      <RecentRolls open={recentRollsOpen} onClose={() => setRecentRollsOpen(false)} rolls={recentRolls} />
    </Overlay>
  )
}
