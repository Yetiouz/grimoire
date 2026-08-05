import { Badge, type BadgeTone } from '../../../components/ui/Badge'
import { StatusChip } from '../../../components/ui/StatusChip'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

const tones: BadgeTone[] = ['green', 'red', 'yellow', 'orange', 'pink', 'cyan']

/** Badge and Status chip merged into one numbered section
 * (styleguide-mockup.html's "006 Badges & Chips") — they were two
 * separate style-guide sections before this rebuild; Badge.tsx and
 * StatusChip.tsx themselves are untouched, this only changes how their
 * demos are composed on the page. */
export function BadgesChipsSection() {
  return (
    <Section
      id="sec-badges"
      number="007"
      group="Components"
      title="Badges & Chips"
      description="Badge — a status tag; color lives in the dot only, so a row stays legible with several tones side by side. Status chip — Badge's technical cousin, a mono key:value pill for compact readouts. Same six tones, no new colors."
    >
      <div className="flex flex-col gap-3">
        <p className={text.label}>Badge / chip</p>
        <SpecimenGrid>
          <Specimen tag="BADGE_STATUS" state="LIVE">
            <Badge tone="green" variant="status">
              In development
            </Badge>
          </Specimen>
          <Specimen tag="BADGE_INDICATOR" state="TONES">
            <div className="flex flex-wrap gap-2">
              {tones.map((tone) => (
                <Badge key={tone} tone={tone} variant="indicator">
                  {tone}
                </Badge>
              ))}
            </div>
          </Specimen>
        </SpecimenGrid>
      </div>
      <div className="flex flex-col gap-3">
        <p className={cx('mt-2', text.label)}>Status chip</p>
        <SpecimenGrid>
          <Specimen tag="STATUS_CHIP" state="LIVE">
            <StatusChip label="Torch" value="38m" tone="orange" />
          </Specimen>
          <Specimen tag="STATUS_CHIP" state="VARIANTS">
            <div className="flex flex-wrap gap-3">
              <StatusChip label="HP" value="12/15" tone="red" />
              <StatusChip label="AC" value="14" />
              <StatusChip label="Zone" value="Near" tone="cyan" />
            </div>
          </Specimen>
        </SpecimenGrid>
      </div>
    </Section>
  )
}
