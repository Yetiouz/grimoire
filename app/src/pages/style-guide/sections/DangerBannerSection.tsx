import { DangerBanner } from '../../../components/ui/DangerBanner'
import { Section } from '../Section'

export function DangerBannerSection() {
  return (
    <Section
      title="Danger banner"
      description="Full-width alert for urgent game-state moments (dying, a triggered trap). Static and presentational — no dismiss or timeout logic; the caller decides when it mounts and unmounts."
    >
      <div className="flex flex-col gap-3">
        <DangerBanner tone="danger">Bjorn is dying — stabilize within 1d4+CON rounds.</DangerBanner>
        <DangerBanner tone="warning">A pressure plate clicks underfoot.</DangerBanner>
      </div>
    </Section>
  )
}
