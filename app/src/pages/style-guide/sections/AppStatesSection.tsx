import { DangerBanner } from '../../../components/ui/DangerBanner'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen } from '../Specimen'

/** Replaces the old standalone Danger banner section
 * (styleguide-mockup.html's "010 App States"). Danger banner is real and
 * migrates in full; EmptyState/Skeleton/ErrorBanner (the "earlier audit
 * fixes" still on the list) aren't built yet, so this section closes with
 * a placeholder rather than migrated content — same shape as the
 * mockup's "SECTION CONTENT MIGRATES HERE" cells, reworded since nothing
 * exists yet to migrate. */
export function AppStatesSection() {
  return (
    <Section
      id="sec-states"
      number="015"
      group="Components"
      title="App States"
      description="Full-width, presentational status communication — no dismiss/timeout logic, the caller decides when it mounts and unmounts."
    >
      <div className="flex flex-col gap-3">
        <p className={text.label}>Danger banner</p>
        <div className="flex flex-col gap-2">
          <Specimen tag="DANGER_BANNER" state="DANGER" tone="red">
            <DangerBanner tone="danger" className="w-full">
              Bjorn is dying — stabilize within 1d4+CON rounds.
            </DangerBanner>
          </Specimen>
          <Specimen tag="DANGER_BANNER" state="WARNING" tone="orange">
            <DangerBanner tone="warning" className="w-full">
              A pressure plate clicks underfoot.
            </DangerBanner>
          </Specimen>
        </div>
      </div>
      <div
        className={cx(
          'flex items-center justify-center rounded-card border border-dashed border-line px-4 py-6 text-center',
          text.caption,
          'uppercase tracking-eyebrow text-ink-faint',
        )}
      >
        EmptyState / Skeleton / ErrorBanner — not yet built. Land here once specced.
      </div>
    </Section>
  )
}
