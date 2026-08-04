import { Badge, type BadgeTone } from '../../../components/ui/Badge'
import { Section } from '../Section'

const tones: BadgeTone[] = ['green', 'red', 'yellow', 'orange', 'pink', 'cyan']

export function BadgeSection() {
  return (
    <Section
      title="Badge / Chip"
      description="Two variants of the same shape: 'status' (a single-instance line, e.g. an 'in development' indicator) and 'indicator' (several shown together in a row). Color lives in the dot only, per the style guide's 'keeps a row legible' rule."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="green" variant="status">
            In development
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <Badge key={tone} tone={tone} variant="indicator">
              {tone}
            </Badge>
          ))}
        </div>
      </div>
    </Section>
  )
}
