import { StatusChip } from '../../../components/ui/StatusChip'
import { Section } from '../Section'

export function StatusChipSection() {
  return (
    <Section
      title="Status chip"
      description="Badge's technical cousin: a mono key:value pill for compact readouts (torch time, a die size, a coordinate) rather than Badge's single status word. Same six tones, same pill shape — no new colors."
    >
      <div className="flex flex-wrap gap-3">
        <StatusChip label="Torch" value="38m" tone="orange" />
        <StatusChip label="HP" value="12/15" tone="red" />
        <StatusChip label="AC" value="14" />
        <StatusChip label="Zone" value="Near" tone="cyan" />
      </div>
    </Section>
  )
}
