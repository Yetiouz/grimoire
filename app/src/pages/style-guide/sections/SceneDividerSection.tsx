import { SceneDivider } from '../../../components/ui/SceneDivider'
import { Section } from '../Section'
import { Specimen } from '../Specimen'

export function SceneDividerSection() {
  return (
    <Section
      id="sec-divider"
      number="012"
      group="Components"
      title="Scene Divider"
      description="Typographic scene/chapter break — a centered label flanked by rule lines. No icon or ornament dependency; icons are governed separately (see Iconography)."
    >
      <Specimen tag="SCENE_DIVIDER" state="DEFAULT" tone="faint">
        <div className="flex w-full flex-col gap-6">
          <SceneDivider>Three days later</SceneDivider>
          <SceneDivider>Chapter II — The Bull Statue</SceneDivider>
        </div>
      </Specimen>
    </Section>
  )
}
