import { DiceResult } from '../../../components/ui/DiceResult'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function DiceResultSection() {
  return (
    <Section
      id="sec-dice"
      number="010"
      group="Components"
      title="Dice Result"
      description="Shows a rolled total with an optional modifier breakdown. Outcome (critical/fumble) is caller-decided — this component doesn't know Shadowdark's crit rules, it renders whichever outcome it's told."
    >
      <SpecimenGrid cols={3}>
        <Specimen tag="DICE_RESULT" state="DEFAULT" tone="faint">
          <DiceResult roll={14} modifier={3} />
        </Specimen>
        <Specimen tag="DICE_RESULT" state="CRITICAL" tone="green">
          <DiceResult roll={20} outcome="critical" />
        </Specimen>
        <Specimen tag="DICE_RESULT" state="FUMBLE" tone="red">
          <DiceResult roll={1} outcome="fumble" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
