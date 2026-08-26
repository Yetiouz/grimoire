import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { SYSTEM_OPTIONS } from '../../lib/campaigns'
import type { System } from '../../lib/campaigns'

interface SystemSelectorProps {
  value: System
  onChange: (system: System) => void
  className?: string
}

/** Game-system picker for "New Campaign" — same `DieSelector`-shaped
 * `radiogroup` of pills as `GmModeSelector`, plus a one-line caption for
 * whichever option is currently selected, so the two pickers in that
 * modal read as one family rather than two different controls (owner,
 * 2026-08-26: "we need to build in a wizard for that game also").
 *
 * CY_BORG is a real, selectable option here even though its guided
 * creation wizard isn't built yet — `SYSTEM_OPTIONS`' own `hasWizard`
 * flag is what puts "wizard coming soon" in its caption, not a disabled
 * state. Nothing about starting a CY_BORG campaign depends on the wizard
 * existing (Shop, CharacterSheet, and chat-based play already work for
 * it); `CharacterBuilder`'s `hasRulesModule` gate is the thing that
 * actually decides guided creation, separately, later. */
export function SystemSelector({ value, onChange, className }: SystemSelectorProps) {
  const selected = SYSTEM_OPTIONS.find((option) => option.value === value) ?? SYSTEM_OPTIONS[0]

  return (
    <div className={className}>
      <div className="flex gap-2" role="radiogroup" aria-label="Game system">
        {SYSTEM_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-button border px-3 py-2 text-center',
              value === option.value
                ? 'border-purple bg-purple text-white'
                : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
              text.label,
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selected && <p className={cx(text.caption, 'mt-2 text-ink-faint')}>{selected.description}</p>}
    </div>
  )
}
