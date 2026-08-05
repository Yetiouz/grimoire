import { Icon } from '../../../components/ui/Icon'
import type { IconName } from '../../../components/ui/Icon'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

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

/** lucide-react, governed by strict rules (SPEC.md). Everything here is
 * enforced by Icon.tsx itself, not just convention — this section is a
 * demonstration of the rules, not the rules' only home. */
export function IconographySection() {
  return (
    <Section
      id="sec-icons"
      number="004"
      group="Foundation"
      title="Iconography"
      description="lucide-react. Every icon renders on the same 24px grid with the same stroke weight — not exposed as per-usage props — and is colored only through the three states below, never an arbitrary color. `name` is a closed set (see Icon.tsx): the initial working set the journal and nav actually need, not lucide's full library."
    >
      {/* Hand-written rather than mapped over a states array — a fixed
       * set of exactly three, same as every other component section in
       * this file that renders a small known set of specimens. */}
      <SpecimenGrid cols={3}>
        <Specimen tag="ICON_HP" state="DEFAULT" tone="faint">
          <div className="flex items-center gap-3">
            <Icon name="hp" state="default" label="default state example" />
            <div>
              <p className={text.body}>default</p>
              <p className={cx(text.caption, 'text-ink-faint')}>ink-dim — the resting state.</p>
            </div>
          </div>
        </Specimen>
        <Specimen tag="ICON_HP" state="ACTIVE" tone="purple">
          <div className="flex items-center gap-3">
            <Icon name="hp" state="active" label="active state example" />
            <div>
              <p className={text.body}>active</p>
              <p className={cx(text.caption, 'text-ink-faint')}>purple — the app's one accent color.</p>
            </div>
          </div>
        </Specimen>
        <Specimen tag="ICON_HP" state="DANGER" tone="red">
          <div className="flex items-center gap-3">
            <Icon name="hp" state="danger" label="danger state example" />
            <div>
              <p className={text.body}>danger</p>
              <p className={cx(text.caption, 'text-ink-faint')}>red — same tone DangerBanner and dice fumbles already use.</p>
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
