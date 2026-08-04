import { PortraitAvatar } from '../../../components/ui/PortraitAvatar'
import { Section } from '../Section'

export function PortraitAvatarSection() {
  return (
    <Section
      title="Portrait / identity color"
      description="Circular avatar ringed in the character's color — the same 'one PC color everywhere' mechanism Log entry row uses for sender names. Falls back to initials since no portrait images exist yet."
    >
      <div className="flex flex-wrap items-end gap-4">
        <PortraitAvatar name="Bjorn Ironhand" color="#9b5cff" size="lg" />
        <PortraitAvatar name="Allindra" color="#35f0ff" size="md" />
        <PortraitAvatar name="System" color="#a5a5ae" size="sm" />
      </div>
    </Section>
  )
}
