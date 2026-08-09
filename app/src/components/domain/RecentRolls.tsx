import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
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
  rolls: RecentRoll[]
  className?: string
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
 */
export function RecentRolls({ rolls, className }: RecentRollsProps) {
  if (rolls.length === 0) return null
  const shown = rolls.slice(0, MAX_SHOWN)

  return (
    <div className={cx('flex w-full flex-col gap-2 text-left', className)}>
      <p className={text.label}>Recent rolls</p>
      <div className="flex flex-col divide-y divide-line-soft rounded-card border border-line-soft bg-panel2">
        {shown.map((roll) => {
          const total = roll.result.total + (roll.modifier?.value ?? 0)
          return (
            <div key={roll.id} className="flex items-center gap-3 px-3 py-2">
              <DieIcon die={roll.result.die} className="h-5 w-5 shrink-0 text-ink-faint" />
              <span className={cx(text.bodySecondary, 'flex-1 truncate')}>
                {describeRoll(roll.result, roll.modifier)}
              </span>
              <span className={cx(text.numeric, 'shrink-0')}>{total}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
