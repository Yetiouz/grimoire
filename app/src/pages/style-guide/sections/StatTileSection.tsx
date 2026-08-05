import { StatTile } from '../../../components/ui/StatTile'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

export function StatTileSection() {
  return (
    <Section
      id="sec-stats"
      number="008"
      group="Components"
      title="Stat Tiles"
      description="Not in the landing page — new for the app's data-display needs (an HP/AC/Gear/Luck/Torch header strip). Label + value only; no color-threshold logic like 'HP is low', since that needs real game state this component doesn't have yet."
    >
      <SpecimenGrid>
        <Specimen tag="STAT_TILE" state="ACCENT" tone="red">
          <div className="grid w-full grid-cols-3 gap-2">
            <StatTile label="HP" value="12/15" accent="red" />
            <StatTile label="Luck" value="1" accent="cyan" />
            <StatTile label="Torch" value="45m" accent="orange" />
          </div>
        </Specimen>
        <Specimen tag="STAT_TILE" state="DEFAULT" tone="faint">
          <div className="grid w-full grid-cols-2 gap-2">
            <StatTile label="AC" value="14" />
            <StatTile label="Gear" value="7/10" />
          </div>
        </Specimen>
      </SpecimenGrid>
    </Section>
  )
}
