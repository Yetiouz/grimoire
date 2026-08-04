import { StatTile } from '../../../components/ui/StatTile'
import { Section } from '../Section'

export function StatTileSection() {
  return (
    <Section
      title="Stat tile"
      description="Not in the landing page — new for the app's data-display needs (an HP/AC/Gear/Luck/Torch header strip). Label + value only; no color-threshold logic like 'HP is low', since that needs real game state this component doesn't have yet."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="HP" value="12/15" accent="red" />
        <StatTile label="AC" value="14" />
        <StatTile label="Gear" value="7/10" />
        <StatTile label="Luck" value="1" accent="cyan" />
        <StatTile label="Torch" value="45m" accent="orange" />
      </div>
    </Section>
  )
}
