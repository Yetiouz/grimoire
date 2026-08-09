import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
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
 * Always rendered now (owner's third round of feedback: "I want the
 * animation window to always be there") — `DiceRoller` leads its column
 * with this card unconditionally rather than only mounting it once a
 * first result exists, so the sheet's layout doesn't shift height the
 * moment the first roll lands. That means a genuine third, idle state
 * (never rolled yet, or every control just got changed and
 * `clearResult()` ran) alongside the existing rolling and settled ones —
 * the circle shows a neutral em dash rather than either the flicker or a
 * stale total.
 *
 * **Circular hero badge** (owner's reference pass, pointed at a mobile
 * attack-roll mockup with a big single circled number as the focal
 * point): the total sits inside a bordered circle rather than as bare
 * `dataDisplay` text — neutral-bordered for both the idle and the
 * in-flight flicker states, purple-bordered only once a result has
 * actually settled, so the settled state reads as the one that "commits"
 * visually and idle doesn't borrow that same purple.
 *
 * The die glyph that used to sit above the circle (notation label plus
 * an animated icon) was dropped in the same round — the owner called it
 * redundant with the notation text right above the circle ("The D100
 * indicator in the animation window is redundant we do not need it at
 * the top"), so the title/notation line is now the only thing above the
 * circle.
 *
 * Layout: the die notation once a result exists ("2d6", "2d20 kept"),
 * falling back to just the selected die ("d20") while rolling, idle, or
 * before a first roll, so the title slot never goes empty — then the
 * circled total, then the individual dice, then the formatted log text,
 * each its own centered, stacked block. Everything here already inherits
 * `items-center text-center` from the outer flex column; the
 * individual-dice row additionally caps its width so a full 10-die roll
 * wraps into two centered rows instead of one long line, rather than
 * relying on the card's width alone.
 *
 * The block below the circle (individual dice + formatted text) is
 * always mounted, rather than only existing once `settled` — owner's
 * fifth round: "keep the window the size it is after a roll, no need to
 * bounce back and forth." Unmounting it for idle/rolling was what caused
 * the bounce: the card grew every time a result settled and shrank back
 * every time a control change cleared it, on every single roll.
 *
 * First attempt at this reserved a fixed height sized for the tallest
 * possible content (a 10-die roll's two wrapped chip rows) — technically
 * bounce-free, but the owner's next round called it out directly: "looks
 * stupid and its bigger than it was previously," since every single-die
 * roll (the common case) now sat inside a mostly-empty box far taller
 * than the one line of text it actually needed. Replaced with an
 * invisible placeholder line, sized by the browser to match
 * `bodySecondary`'s own text metrics exactly rather than a guessed
 * pixel value — this reserves only as much space as the formatted-text
 * line itself takes, which is what every roll shows regardless of dice
 * count. A roll whose individual-dice row also renders (count > 1, or
 * advantage/disadvantage) still grows the card a little beyond that —
 * an accepted, much smaller trade-off than either the oversized fixed
 * box or the original full bounce.
 */
export function RollResult({ rolling, die, result, modifier, flickerTotal, className }: RollResultProps) {
  const settled = !rolling && result !== null
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
      <div
        className={cx(
          'flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 bg-panel xl:h-32 xl:w-32',
          settled ? 'border-purple' : 'border-line',
        )}
      >
        {rolling ? (
          // Flicker only — never the real result. The actual server
          // total (and the formatted log text below it) only ever
          // appears once `result` comes back.
          <span className={cx(text.dataDisplay, 'tabular-nums text-ink-dim')}>{flickerTotal ?? '···'}</span>
        ) : settled ? (
          <span className={text.dataDisplay}>{total}</span>
        ) : (
          // Idle — no roll yet this time the sheet opened, or the last
          // one was invalidated by a control change (`clearResult()`).
          <span className={cx(text.dataDisplay, 'text-ink-faint')}>—</span>
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-2">
        {settled && result ? (
          <>
            {/* Individual dice, not just the total — shown whenever more
             * than one physical die was actually rolled (any count > 1,
             * or advantage/disadvantage's two full sets even at count
             * 1). The kept set gets a purple border; a discarded
             * advantage/disadvantage set renders dimmed and struck
             * through, so it's visible which numbers counted without
             * hiding the ones that didn't. Width-capped so it centers
             * as two rows at the max 10-die count instead of one long
             * strip. */}
            {(result.rolls.length > 1 || result.otherRolls) && (
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
            <span className={text.bodySecondary}>{formatRollText(result, modifier)}</span>
          </>
        ) : (
          // Invisible placeholder, not an empty div: matching
          // `bodySecondary`'s own classes means the browser reserves
          // exactly one line of that text's real height rather than a
          // hand-picked pixel guess, so idle/rolling take up the same
          // space the common (no dice-chip row) settled case actually
          // needs.
          <span className={cx(text.bodySecondary, 'invisible')} aria-hidden="true">
            placeholder
          </span>
        )}
      </div>
    </div>
  )
}
