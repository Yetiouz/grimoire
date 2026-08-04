import { DiceResult } from '../../../components/ui/DiceResult'
import { Section } from '../Section'

export function DiceResultSection() {
  return (
    <Section
      title="Dice result"
      description="Shows a rolled total with an optional modifier breakdown. Outcome (critical/fumble) is caller-decided — this component doesn't know Shadowdark's crit rules, it renders whichever outcome it's told."
    >
      <div className="flex flex-wrap gap-4">
        <DiceResult roll={14} modifier={3} />
        <DiceResult roll={20} outcome="critical" />
        <DiceResult roll={1} outcome="fumble" />
      </div>
    </Section>
  )
}
