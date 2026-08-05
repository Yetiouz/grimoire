import { Panel } from '../../../components/ui/Panel'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function PanelSection() {
  return (
    <Section
      id="sec-panel"
      number="005"
      group="Foundation"
      title="Panel"
      description="Base card container. Static by default; pass `interactive` for panels that are themselves clickable — hover lightens the border and lifts slightly."
    >
      <SpecimenGrid>
        <Specimen tag="PANEL" state="STATIC" tone="faint">
          <Panel className="w-full">
            <p className="text-sm text-ink-dim">Static panel — default state.</p>
          </Panel>
        </Specimen>
        <Specimen tag="PANEL" state="INTERACTIVE" tone="purple">
          <Panel interactive className="w-full">
            <p className="text-sm text-ink-dim">Interactive panel — hover to see the lift + border change.</p>
          </Panel>
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
