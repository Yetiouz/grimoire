import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { DieIcon } from '../ui/DieIcon'
import { formatRollText } from '../../lib/dice'
import type { DieType, DiceRollResult, RollModifier } from '../../lib/dice'

interface RollResultProps {
  rolling: boolean
  die: DieType
  result: DiceRollResult | null
  modifier?: RollModifier
  /** Rapid-cycling stand-in shown only while `rolling` is true — pure
   * visual flourish (a "slot reel" flicker) owned by `DiceRoller`, never
   * the value that gets logged; the real total below always comes from
   * `result`, which is server-authoritative. */
  flickerTotal: number | null
  className?: string
}

/**
 * BUILD_PLAN.md's named `RollResult` domain component ("dice math,
 * tabular numerals") — split out of `DiceRoller.tsx` in the
 * retroactive-review pass (that file was 367 lines, over CLAUDE.md's
 * ~300-line cap) rather than staying inlined. Given a roll result (or
 * the rolling-in-flight state) it renders itself; it has no dependency
 * on `DiceRoller`'s controls state, which is what makes it a clean
 * split rather than an arbitrary one.
 *
 * Renders nothing before the first roll (no result, not rolling) —
 * `DiceRoller` no longer needs its own visibility gate around this.
 *
 * The die glyph is fixed-size in every state (rolling and settled share
 * one size — the retroactive-review pass that first set this up was
 * fixing a real bug, the inlined version varying 28px/36px between
 * states) but the size itself has grown twice since: 24px originally
 * (matching `Icon.tsx`'s 24px grid), then to a real hero size at the
 * owner's request — the roll animation is this card's whole point and
 * read as an afterthought squeezed above the numbers at icon scale.
 * `DieIcon` is its own primitive outside `Icon.tsx`'s closed lucide set
 * already (see its own header comment), so sizing it well past 24px
 * here doesn't touch that governance — it was never grid-bound to begin
 * with, just drawn at grid size by habit.
 *
 * Layout (owner's second round of feedback on this same card): a title
 * comes first — the die notation once a result exists ("2d6", "2d20
 * kept"), falling back to just the selected die ("d20") while rolling
 * or before a first roll, so the title slot never goes empty — with the
 * animated glyph directly under it, then the total, then the individual
 * dice, then the formatted log text, each its own centered, stacked
 * block. Everything here already inherits `items-center text-center`
 * from the outer flex column; the individual-dice row additionally caps
 * its width so a full 10-die roll wraps into two centered rows instead
 * of one long line, rather than relying on the card's width alone.
 */
export function RollResult({ rolling, die, result, modifier, flickerTotal, className }: RollResultProps) {
  if (!rolling && !result) return null

  const total = result ? result.total + (modifier?.value ?? 0) : null
  const notation = result
    ? result.mode === 'normal'
      ? result.count > 1
        ? `${result.count}${result.die}`
        : result.die
      : `${result.count * 2}${result.die} kept`
    : die

  return (
    <div
      className={cx(
        'flex flex-col items-center gap-4 rounded-card border border-line-soft bg-panel2 px-4 py-4 text-center',
        className,
      )}
    >
      <span className={text.label}>{notation}</span>
      <DieIcon die={die} rolling={rolling} className="h-20 w-20 text-purple" />
      {rolling ? (
        // Flicker only — never the real result. The actual server total
        // (and the formatted log text below it) only ever appears once
        // `result` comes back.
        <span className={cx(text.dataDisplay, 'tabular-nums text-ink-dim')}>{flickerTotal ?? '···'}</span>
      ) : (
        <div className="flex w-full flex-col items-center gap-2">
          <span className={text.dataDisplay}>{total}</span>
          {/* Individual dice, not just the total — shown whenever more
           * than one physical die was actually rolled (any count > 1,
           * or advantage/disadvantage's two full sets even at count 1).
           * The kept set gets a purple border; a discarded advantage/
           * disadvantage set renders dimmed and struck through, so it's
           * visible which numbers counted without hiding the ones that
           * didn't. Width-capped so it centers as two rows at the max
           * 10-die count instead of one long strip. */}
          {result && (result.rolls.length > 1 || result.otherRolls) && (
            <div className="flex max-w-[240px] flex-wrap items-center justify-center gap-1">
              {result.rolls.map((value, index) => (
                <span
                  key={`kept-${index}`}
                  className={cx(text.caption, 'rounded-md border border-purple bg-panel px-2 py-1 tabular-nums')}
                >
                  {value}
                </span>
              ))}
              {result.otherRolls?.map((value, index) => (
                <span
                  key={`other-${index}`}
                  className={cx(
                    text.caption,
                    'rounded-md border border-line-soft bg-panel px-2 py-1 tabular-nums text-ink-faint line-through',
                  )}
                >
                  {value}
                </span>
              ))}
            </div>
          )}
          <span className={text.bodySecondary}>{result && formatRollText(result, modifier)}</span>
        </div>
      )}
    </div>
  )
}
