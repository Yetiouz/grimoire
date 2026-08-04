import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

interface SpacingSlot {
  name: string
  pxLabel: string
  /** Tailwind gap-* class matching this slot, used to render the live
   * example with the actual on-scale value rather than an approximation. */
  gapClass: string
  description: string
}

const slots: SpacingSlot[] = [
  { name: 'micro', pxLabel: '4px', gapClass: 'gap-1', description: 'Tight pairs — a dot next to its label.' },
  {
    name: 'related',
    pxLabel: '8–12px',
    gapClass: 'gap-2',
    description: 'Grouped items — a row of tiles, an icon-to-label gap.',
  },
  { name: 'component', pxLabel: '16px', gapClass: 'gap-4', description: "Padding inside a card/panel." },
  { name: 'separated', pxLabel: '24px', gapClass: 'gap-6', description: 'Distinct blocks on the same screen.' },
  { name: 'section', pxLabel: '48px', gapClass: 'gap-12', description: 'Space between whole page regions.' },
  {
    name: 'page',
    pxLabel: '64px desktop / 24px gutter phone',
    gapClass: 'gap-16',
    description: 'Page-level margin.',
  },
]

/** The ratified spacing scale (SPEC.md "Spacing is a closed scale"),
 * rendered as a live ladder rather than just described — each slot's
 * example uses the real gap-* class for that value, so the page is
 * itself proof the scale renders as claimed. Sits right after
 * Typography since both are foundational tokens, not components. */
export function SpacingSection() {
  return (
    <Section
      title="Spacing"
      description="A closed scale — 4/8/12/16/24/32/48/64px only, no arbitrary values. Name spacing in slot terms (“component padding”), not raw pixels. 32px is on the scale but isn't tied to a named slot — an available in-between value, not a default choice."
    >
      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-panel">
        {slots.map(({ name, pxLabel, gapClass, description }) => (
          <div key={name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="w-28 shrink-0">
              <p className={text.body}>{name}</p>
              <p className={cx(text.caption, 'text-ink-faint')}>{pxLabel}</p>
            </div>
            <div className={cx('flex shrink-0 items-center', gapClass)} aria-hidden="true">
              <span className="h-6 w-6 shrink-0 rounded bg-purple/60" />
              <span className="h-6 w-6 shrink-0 rounded bg-purple/60" />
            </div>
            <p className={cx(text.bodySecondary, 'sm:flex-1')}>{description}</p>
          </div>
        ))}
      </div>
      <div className="rounded-card border border-purple/30 bg-panel2 px-4 py-3">
        <p className={text.body}>
          Rule: only these eight values exist on the scale — no arbitrary spacing anywhere on any screen.
        </p>
      </div>
    </Section>
  )
}
