import { Button } from '../../../components/ui/Button'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function ButtonSection() {
  return (
    <Section
      id="sec-buttons"
      number="006"
      group="Components"
      title="Buttons"
      description="Two variants. Rounded-rect by design — buttons read as buttons; pills (see Badges & Chips) read as tags."
    >
      <SpecimenGrid>
        <Specimen tag="BTN_PRIMARY" state="DEFAULT">
          <Button variant="primary">Log Entry</Button>
        </Specimen>
        <Specimen tag="BTN_GHOST" state="DEFAULT">
          <Button variant="ghost">Cancel</Button>
        </Specimen>
        <Specimen tag="BTN_PRIMARY" state="DISABLED" tone="faint">
          <Button variant="primary" disabled>
            Log Entry
          </Button>
        </Specimen>
        <Specimen tag="BTN_GHOST" state="DISABLED" tone="faint">
          <Button variant="ghost" disabled>
            Cancel
          </Button>
        </Specimen>
      </SpecimenGrid>
      <p className={cx(text.caption, 'text-ink-faint')}>
        Tab to a button to see the focus ring — a keyboard-only affordance not in the original landing page.
      </p>
    </Section>
  )
}
