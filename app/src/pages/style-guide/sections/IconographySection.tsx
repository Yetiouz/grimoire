import { Icon } from '../../../components/ui/Icon'
import type { IconName, IconState } from '../../../components/ui/Icon'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

const iconEntries: Array<{ name: IconName; label: string }> = [
  { name: 'hp', label: 'HP' },
  { name: 'ac', label: 'AC' },
  { name: 'gear', label: 'Gear' },
  { name: 'luck', label: 'Luck' },
  { name: 'torch', label: 'Torch' },
  { name: 'journal', label: 'Journal' },
  { name: 'chat', label: 'Chat' },
  { name: 'dice', label: 'Dice' },
  { name: 'party', label: 'Party' },
  { name: 'settings', label: 'Settings' },
  { name: 'close', label: 'Close' },
  { name: 'disclosure', label: 'Disclosure' },
]

const stateEntries: Array<{ state: IconState; note: string }> = [
  { state: 'default', note: 'ink-dim — the resting state.' },
  { state: 'active', note: "purple — the app's one accent color." },
  { state: 'danger', note: 'red — same tone DangerBanner and dice fumbles already use.' },
]

/** lucide-react, governed by strict rules (SPEC.md). Everything here is
 * enforced by Icon.tsx itself, not just convention — this section is a
 * demonstration of the rules, not the rules' only home. */
export function IconographySection() {
  return (
    <Section
      title="Iconography"
      description="lucide-react. Every icon renders on the same 24px grid with the same stroke weight — not exposed as per-usage props — and is colored only through the three states below, never an arbitrary color. `name` is a closed set (see Icon.tsx): the initial working set the journal and nav actually need, not lucide's full library."
    >
      <div className="flex flex-col gap-4 rounded-card border border-line bg-panel p-4">
        <div className="flex flex-wrap gap-6">
          {stateEntries.map(({ state, note }) => (
            <div key={state} className="flex items-center gap-2">
              <Icon name="hp" state={state} label={`${state} state example`} />
              <div>
                <p className={text.body}>{state}</p>
                <p className={cx(text.caption, 'text-ink-faint')}>{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {iconEntries.map(({ name, label }) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-card border border-line bg-panel p-4"
          >
            <Icon name={name} label={label} />
            <span className={cx(text.caption, 'text-ink-faint')}>{label}</span>
          </div>
        ))}
      </div>
      <div className="rounded-card border border-purple/30 bg-panel2 px-4 py-3">
        <p className={text.body}>
          Rule: every icon goes through {'<Icon name="..." state="..." />'} — no raw lucide imports, no ad-hoc
          size/stroke/color anywhere on any screen.
        </p>
      </div>
    </Section>
  )
}
