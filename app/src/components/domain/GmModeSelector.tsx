import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { gmEnabled } from '../../lib/gm'
import { GM_MODE_OPTIONS } from '../../lib/campaigns'
import type { GmMode } from '../../lib/campaigns'

interface GmModeSelectorProps {
  value: GmMode
  onChange: (mode: GmMode) => void
  className?: string
}

/** GM mode picker — a `DieSelector`-shaped `radiogroup` of three pills
 * (Solo / Human GM / AI GM), plus a one-line caption underneath showing
 * whichever option is currently selected's description rather than
 * repeating all three descriptions at once. Shared by both halves of
 * the owner's 2026-08-15 request ("i want one when starting a
 * campaign. and a toggle.") — `CampaignList`'s "New Campaign" modal and
 * `CampaignGmModeModal`'s settings toggle for an existing one — so the
 * two surfaces can't drift apart in copy or behavior.
 *
 * `AI GM` is left out of the option list entirely when this build's
 * `VITE_GM_ENABLED` flag is off, same gate `JournalScreen`'s own
 * `aiGmActive` already applies before showing any AI-only chrome —
 * offering a mode this build has no working AI turn generator for would
 * just strand a campaign on a choice that quietly does nothing. */
export function GmModeSelector({ value, onChange, className }: GmModeSelectorProps) {
  const options = GM_MODE_OPTIONS.filter((option) => option.value !== 'ai' || gmEnabled)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className={className}>
      <div className="flex gap-2" role="radiogroup" aria-label="GM mode">
        {options.map((option) => (
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
