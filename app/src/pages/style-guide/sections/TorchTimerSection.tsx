import { TorchTimer } from '../../../components/ui/TorchTimer'
import { Section } from '../Section'

export function TorchTimerSection() {
  return (
    <Section
      title="Torch timer"
      description="Extends Stat tile's shape with a progress bar. Tone is caller-decided — no baked-in 'under 5 min = red' threshold logic, same rule as Stat tile."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <TorchTimer minutesRemaining={52} minutesTotal={60} accent="orange" />
        <TorchTimer minutesRemaining={14} minutesTotal={60} accent="yellow" />
        <TorchTimer minutesRemaining={3} minutesTotal={60} accent="red" />
      </div>
    </Section>
  )
}
