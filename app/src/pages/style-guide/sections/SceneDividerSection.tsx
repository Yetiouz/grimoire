import { SceneDivider } from '../../../components/ui/SceneDivider'
import { Section } from '../Section'

export function SceneDividerSection() {
  return (
    <Section
      title="Scene divider"
      description="Typographic scene/chapter break — a centered label flanked by rule lines. No icon or ornament dependency; iconography is a separate, not-yet-built system."
    >
      <div className="flex flex-col gap-6">
        <SceneDivider>Three days later</SceneDivider>
        <SceneDivider>Chapter II — The Bull Statue</SceneDivider>
      </div>
    </Section>
  )
}
