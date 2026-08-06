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
 * Fixed 24px icon in every state (retroactive-review fix: the inlined
 * version varied 28px/36px between settled/rolling, breaking Icon.tsx's
 * "every icon renders at the same 24px grid" rule — not a deliberate,
 * documented exception, just a miss).
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
    : null

  return (
    <div
      className={cx(
        'flex flex-col items-center gap-2 rounded-card border border-line-soft bg-panel2 px-4 py-4 text-center',
        className,
      )}
    >
      <DieIcon die={die} rolling={rolling} className="h-6 w-6 text-purple" />
      {rolling ? (
        // Flicker only — never the real result. The actual server total
        // (and the formatted log text below it) only ever appears once
        // `result` comes back.
        <span className={cx(text.dataDisplay, 'tabular-nums text-ink-dim')}>{flickerTotal ?? '···'}</span>
      ) : (
        <>
          <span className={text.label}>{notation}</span>
          <span className={text.dataDisplay}>{total}</span>
          {/* Individual dice, not just the total — shown whenever more
           * than one physical die was actually rolled (any count > 1,
           * or advantage/disadvantage's two full sets even at count 1).
           * The kept set gets a purple border; a discarded advantage/
           * disadvantage set renders dimmed and struck through, so it's
           * visible which numbers counted without hiding the ones that
           * didn't. */}
          {result && (result.rolls.length > 1 || result.otherRolls) && (
            <div className="flex flex-wrap items-center justify-center gap-1">
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
        </>
      )}
    </div>
  )
}
