import { Panel } from '../../../components/ui/Panel'
import { Section } from '../Section'

export function PanelSection() {
  return (
    <Section
      title="Panel"
      description="Base card container. Static by default; pass `interactive` for panels that are themselves clickable — hover lightens the border and lifts slightly."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <p className="text-sm text-ink-dim">Static panel — default state.</p>
        </Panel>
        <Panel interactive>
          <p className="text-sm text-ink-dim">Interactive panel — hover to see the lift + border change.</p>
        </Panel>
      </div>
    </Section>
  )
}
