import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { Combatant } from '../../lib/encounters'

interface InitiativeRingProps {
  combatants: Combatant[]
  activeIndex: number
  roundNumber: number
}

/**
 * Turn order strip — BUILD_PLAN's own component-list entry: "clockwise,
 * not ranked" (scope doc). Renders `combatants` in the exact array order
 * `roll_initiative` sorted them into (highest roll first) and never
 * re-sorts client-side; `advance_turn` rotates `active_index` through
 * that same fixed order rather than re-ranking, so re-sorting here would
 * fight the server's own model of "clockwise from wherever we started."
 *
 * A monster combatant's pill shows its label only — no HP here even when
 * `hp_visible_to_players` is set, since this component only ever
 * receives `combatants` (label + initiative_roll + acted/moved), not the
 * full `encounter_monsters` row; `MonsterCard` is the one place HP is
 * shown, matching the scope doc's own split between "who's up next" and
 * "monster detail."
 *
 * Empty (`combatants.length === 0`) renders a plain caption rather than
 * `EmptyState`'s full card treatment — this sits inline under
 * `EncounterControls`, not as its own standalone panel.
 */
export function InitiativeRing({ combatants, activeIndex, roundNumber }: InitiativeRingProps) {
  if (combatants.length === 0) {
    return <p className={cx(text.caption, 'text-ink-faint')}>Roll initiative to begin the turn order.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className={cx(text.caption, 'uppercase tracking-eyebrow text-ink-faint')}>Round {roundNumber}</p>
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Turn order">
        {combatants.map((combatant, index) => {
          const isActive = index === activeIndex
          return (
            <span
              key={`${combatant.combatant_type}-${combatant.combatant_id}`}
              role="listitem"
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 whitespace-nowrap',
                text.caption,
                isActive ? 'border-purple/45 bg-purple/15 text-purple' : 'border-line-soft bg-panel2 text-ink-dim',
                combatant.combatant_type === 'monster' && !isActive && 'text-red/70',
              )}
            >
              <b className="font-semibold tabular-nums">{combatant.initiative_roll}</b>
              {combatant.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
