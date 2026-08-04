import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

type DiceOutcome = 'critical' | 'fumble' | 'default'

interface DiceResultProps {
  /** The raw die face, e.g. 20, 1, 14 — not the modified total. */
  roll: number
  sides?: number
  modifier?: number
  /** Caller-decided, same pattern as Stat tile/Torch timer — this
   * component doesn't know Shadowdark's crit rules, it renders whichever
   * outcome it's told. */
  outcome?: DiceOutcome
  className?: string
}

const outcomeBorderClass: Record<DiceOutcome, string> = {
  critical: 'border-green',
  fumble: 'border-red',
  default: 'border-line',
}

// CSS var references (not hex) so this reads from the same theme tokens
// as the rest of the kit. Applied via inline style — same mechanism Log
// entry row uses for sender color — because overriding a closed-set
// typography level's baked-in text color with a second utility class
// has unreliable specificity (Tailwind doesn't order utilities by their
// position in a className string).
const outcomeColorVar: Record<DiceOutcome, string | undefined> = {
  critical: 'var(--color-green)',
  fumble: 'var(--color-red)',
  default: undefined,
}

/** Rolled value with an optional modifier breakdown and crit/fumble
 * styling. Not in the landing page — new territory for the app's dice
 * needs. */
export function DiceResult({ roll, sides = 20, modifier = 0, outcome = 'default', className }: DiceResultProps) {
  const total = roll + modifier
  return (
    <div
      className={cx(
        'inline-flex flex-col items-center gap-1 rounded-card border-2 bg-panel px-4 py-3',
        outcomeBorderClass[outcome],
        className,
      )}
    >
      <span className={text.label} style={{ color: outcomeColorVar[outcome] }}>
        {outcome === 'critical' ? 'Critical' : outcome === 'fumble' ? 'Fumble' : `d${sides}`}
      </span>
      <span className={text.numeric}>{total}</span>
      {modifier !== 0 && (
        <span className={text.bodySecondary}>{`${roll} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`}</span>
      )}
    </div>
  )
}
