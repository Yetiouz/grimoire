import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface EncounterControlsProps {
  /** Whether a `turn_order` row exists for this campaign right now — the
   * same "no row yet" vs "a row, possibly with zero combatants" split
   * `getTurnOrder` returns, not derived from `combatants.length` (an
   * encounter can be open with nobody rolled yet, right after
   * `start_encounter`). */
  encounterOpen: boolean
  hasCombatants: boolean
  starting: boolean
  rolling: boolean
  advancing: boolean
  ending: boolean
  onStart: () => void
  onRoll: () => void
  onAdvance: () => void
  onEnd: () => void
}

/**
 * GM-only encounter transport — start/roll/advance/end, one row of
 * tinted buttons. `EncounterPanel` gates rendering this entirely behind
 * `isOwner` (matching every other GM-only control in the maps command
 * layer, e.g. `MapsRegionTab`'s own owner-only row), so this component
 * itself doesn't re-check ownership.
 *
 * Same "the button IS the state" shape `SessionAction` already
 * established for the session transport: no separate status readout,
 * `encounterOpen`/`hasCombatants` alone decide which buttons are enabled
 * rather than hiding them (a GM re-opening the panel mid-encounter should
 * see the same row, not a different layout, so the controls stay
 * recognizable across the whole lifecycle).
 *
 * "Roll Initiative" stays enabled even with `hasCombatants` true — it's
 * deliberately re-rollable (e.g. after a surprise round), matching
 * `roll_initiative`'s own doc comment: calling it again fully replaces
 * the prior order rather than erroring on "already rolled."
 */
export function EncounterControls({
  encounterOpen,
  hasCombatants,
  starting,
  rolling,
  advancing,
  ending,
  onStart,
  onRoll,
  onAdvance,
  onEnd,
}: EncounterControlsProps) {
  const base = cx(
    'inline-flex h-11 items-center justify-center rounded-button border px-4 font-mono uppercase',
    text.caption,
    'transition-[background-color,border-color,opacity] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  )

  if (!encounterOpen) {
    return (
      <button type="button" onClick={onStart} disabled={starting} className={cx(base, 'border-green/45 bg-green/10 text-green')}>
        {starting ? 'Starting…' : 'Start Encounter'}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onRoll} disabled={rolling} className={cx(base, 'border-purple/45 bg-purple/10 text-purple')}>
        {rolling ? 'Rolling…' : 'Roll Initiative'}
      </button>
      <button
        type="button"
        onClick={onAdvance}
        disabled={advancing || !hasCombatants}
        className={cx(base, 'border-purple/45 bg-purple/10 text-purple')}
      >
        {advancing ? 'Advancing…' : 'Advance Turn'}
      </button>
      <button type="button" onClick={onEnd} disabled={ending} className={cx(base, 'border-red/45 bg-red/10 text-red')}>
        {ending ? 'Ending…' : 'End Encounter'}
      </button>
    </div>
  )
}
