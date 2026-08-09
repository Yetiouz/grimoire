import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Overlay } from '../ui/Overlay'
import { DieIcon } from '../ui/DieIcon'
import type { DiceRollResult, RollModifier } from '../../lib/dice'

/** One entry in `DiceRoller`'s session-local scoreboard. `id` is a
 * monotonic counter, not the array index — this list is prepended to
 * and truncated on every roll, and an index-based key would make React
 * misattribute state across re-renders as older entries shift position. */
export interface RecentRoll {
  id: number
  result: DiceRollResult
  modifier?: RollModifier
}

interface RecentRollsProps {
  open: boolean
  onClose: () => void
  rolls: RecentRoll[]
}

const MAX_SHOWN = 5

function describeRoll(result: DiceRollResult, modifier?: RollModifier): string {
  const notation =
    result.mode === 'normal'
      ? result.count > 1
        ? `${result.count}${result.die}`
        : result.die
      : `${result.count * 2}${result.die} kept`
  return modifier && modifier.value !== 0 ? `${notation} + ${modifier.label}` : notation
}

/**
 * A short-lived scoreboard of what's already been rolled this time the
 * sheet was open (owner's reference pass, pointed at a mobile attack-
 * roll mockup with a "Recent rolls" list under the main roll card) —
 * session-local React state owned by `DiceRoller`, not persisted
 * anywhere. Every roll already lands in the journal via Log if the
 * player wants a permanent record; this is a lighter-weight "what did I
 * just roll" glance for the common case of rolling a few times in a row
 * before deciding which result to keep, without hunting back through
 * the journal feed for it.
 *
 * Split into its own file rather than inlined in `DiceRoller.tsx`,
 * matching that file's own established precedent (its header comment
 * describes splitting `DieSelector.tsx`/`RollResult.tsx` out the same
 * way once it crossed CLAUDE.md's ~300-line cap).
 *
 * Deliberately capped at MAX_SHOWN (5) and deliberately read-only — no
 * tap-to-reapply, no persistence across closing the sheet or reloading
 * the page. If that turns out to be wanted, it's real follow-up scope
 * (tap-to-reapply is pure client state; surviving a reload is genuine
 * new schema), not something to guess at here.
 *
 * Its own overlay window now (owner's fourth round of feedback: "put the
 * recent rolls behind a button so you hit recent rolls and it pulls it
 * up in its own window") rather than a card living inline in the roll
 * sheet's own column — `DiceRoller` renders a "Recent Rolls" button that
 * flips `open`, and this component is the reused `Overlay` primitive
 * (same one `DiceRoller` itself, `CharacterSheet`, and `RulesChat` all
 * sit in) rather than a bespoke bordered box, so it gets the same
 * header/close-button/backdrop/Escape handling as every other window in
 * the app for free instead of reimplementing a smaller version of it.
 * `DiceRoller`'s own `handleClose` closes this window first if it's
 * open, rather than closing both windows at once — see that function's
 * comment for why an unguarded Escape would otherwise skip a level.
 *
 * `Overlay`'s body already scrolls on its own (`min-h-0 flex-1
 * overflow-y-auto`), so this component no longer needs its own nested
 * scroll region — `MAX_SHOWN` stays as a defensive display cap, but in
 * practice `DiceRoller`'s own `MAX_RECENT_ROLLS` already trims the state
 * to the same number before it ever reaches here.
 */
export function RecentRolls({ open, onClose, rolls }: RecentRollsProps) {
  const shown = rolls.slice(0, MAX_SHOWN)

  return (
    <Overlay open={open} onClose={onClose} width="narrow" variant="sheet" header={<h2 className={text.h2}>Recent Rolls</h2>}>
      {shown.length === 0 ? (
        <p className={cx(text.bodySecondary, 'text-ink-faint')}>No rolls yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-line-soft">
          {shown.map((roll) => {
            const total = roll.result.total + (roll.modifier?.value ?? 0)
            return (
              <div key={roll.id} className="flex items-center gap-3 py-3">
                <DieIcon die={roll.result.die} className="h-5 w-5 shrink-0 text-ink-faint" />
                <span className={cx(text.bodySecondary, 'flex-1 truncate')}>
                  {describeRoll(roll.result, roll.modifier)}
                </span>
                <span className={cx(text.numeric, 'shrink-0')}>{total}</span>
              </div>
            )
          })}
        </div>
      )}
    </Overlay>
  )
}
