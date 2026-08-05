import { useState } from 'react'
import { Panel } from '../../../components/ui/Panel'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function PanelSection() {
  const [clicks, setClicks] = useState(0)

  return (
    <Section
      id="sec-panel"
      number="005"
      group="Foundation"
      title="Panel"
      description="Base card container. Static by default; pass `interactive` for panels that are themselves clickable — hover lightens the border and lifts slightly. `interactive` alone is presentational; pass `onClick` too and the panel becomes a real keyboard-operable control (role=button, focusable, Enter/Space activate it) — an audit-fix, since it used to be hover styling with no actual activation path."
    >
      <SpecimenGrid>
        <Specimen tag="PANEL" state="STATIC" tone="faint">
          <Panel className="w-full">
            <p className="text-sm text-ink-dim">Static panel — default state.</p>
          </Panel>
        </Specimen>
        <Specimen tag="PANEL" state="INTERACTIVE" tone="purple">
          <div className="flex w-full flex-col gap-2">
            <Panel interactive onClick={() => setClicks((n: number) => n + 1)} className="w-full">
              <p className="text-sm text-ink-dim">Click, or Tab to it and press Enter/Space.</p>
            </Panel>
            <p className={cx(text.caption, 'text-ink-faint')}>Activated {clicks} time{clicks === 1 ? '' : 's'}.</p>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
