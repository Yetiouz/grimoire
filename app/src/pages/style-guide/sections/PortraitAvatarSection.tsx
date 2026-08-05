import { PortraitAvatar } from '../../../components/ui/PortraitAvatar'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function PortraitAvatarSection() {
  return (
    <Section
      id="sec-portrait"
      number="011"
      group="Components"
      title="Portrait & Identity"
      description="Circular avatar ringed in the character's color — the same 'one PC color everywhere' mechanism Log entry row uses for sender names. Falls back to initials since no portrait images exist yet."
    >
      <SpecimenGrid cols={3}>
        <Specimen tag="PORTRAIT_AVATAR" state="LG">
          <PortraitAvatar name="Bjorn Ironhand" color="#9b5cff" size="lg" />
        </Specimen>
        <Specimen tag="PORTRAIT_AVATAR" state="MD">
          <PortraitAvatar name="Allindra" color="#35f0ff" size="md" />
        </Specimen>
        <Specimen tag="PORTRAIT_AVATAR" state="SM">
          <PortraitAvatar name="System" color="#a5a5ae" size="sm" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
