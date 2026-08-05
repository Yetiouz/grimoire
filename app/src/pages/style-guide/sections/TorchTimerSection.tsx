import { TorchTimer } from '../../../components/ui/TorchTimer'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function TorchTimerSection() {
  return (
    <Section
      id="sec-torch"
      number="009"
      group="Components"
      title="Torch Timer"
      description="Extends Stat tile's shape with a progress bar. Tone is caller-decided — no baked-in 'under 5 min = red' threshold logic, same rule as Stat tile."
    >
      <SpecimenGrid cols={3}>
        <Specimen tag="TORCH_TIMER" state="ACCENT_ORANGE" tone="orange">
          <TorchTimer minutesRemaining={52} minutesTotal={60} accent="orange" className="w-full" />
        </Specimen>
        <Specimen tag="TORCH_TIMER" state="ACCENT_YELLOW" tone="yellow">
          <TorchTimer minutesRemaining={14} minutesTotal={60} accent="yellow" className="w-full" />
        </Specimen>
        <Specimen tag="TORCH_TIMER" state="ACCENT_RED" tone="red">
          <TorchTimer minutesRemaining={3} minutesTotal={60} accent="red" className="w-full" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
