import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { DangerBanner } from '../../../components/ui/DangerBanner'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorBanner } from '../../../components/ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../../../components/ui/Skeleton'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

/** Replaces the old standalone Danger banner section
 * (styleguide-mockup.html's "010 App States"). Danger banner was
 * already real; EmptyState/Skeleton/ErrorBanner were the last of the
 * design-system audit-fix list and now exist too — SPEC's "every screen
 * ships four states: loading, empty, error, populated" is fully covered
 * here (populated is every other section on this page). */
export function AppStatesSection() {
  const [retries, setRetries] = useState(0)

  return (
    <Section
      id="sec-states"
      number="015"
      group="Components"
      title="App States"
      description="SPEC: every screen ships four states — loading, empty, error, populated. Populated is every other section on this page; the three below plus Danger banner cover the rest. Full-width, presentational — no dismiss/timeout logic, the caller decides when each one mounts and unmounts."
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

      <div className="flex flex-col gap-3">
        <p className={cx('mt-2', text.label)}>Error banner</p>
        <SpecimenGrid>
          <Specimen tag="ERROR_BANNER" state="DEFAULT" tone="red">
            <ErrorBanner className="w-full">Failed to load your character. Check your connection.</ErrorBanner>
          </Specimen>
          <Specimen tag="ERROR_BANNER" state="RETRY" tone="red">
            <div className="flex w-full flex-col gap-2">
              <ErrorBanner className="w-full" onRetry={() => setRetries((n: number) => n + 1)}>
                Couldn't save that roll.
              </ErrorBanner>
              <p className={cx(text.caption, 'text-ink-faint')}>Retried {retries} time{retries === 1 ? '' : 's'}.</p>
            </div>
          </Specimen>
        </SpecimenGrid>
      </div>

      <div className="flex flex-col gap-3">
        <p className={cx('mt-2', text.label)}>Empty state</p>
        <SpecimenGrid>
          <Specimen tag="EMPTY_STATE" state="DEFAULT" tone="faint">
            <EmptyState
              className="w-full"
              icon="journal"
              title="No entries yet"
              description="The pages await."
            />
          </Specimen>
          <Specimen tag="EMPTY_STATE" state="WITH_ACTION">
            <EmptyState
              className="w-full"
              icon="party"
              title="No characters yet"
              description="Create one to join the table."
              action={<Button variant="primary">New character</Button>}
            />
          </Specimen>
        </SpecimenGrid>
      </div>

      <div className="flex flex-col gap-3">
        <p className={cx('mt-2', text.label)}>Skeleton</p>
        <Specimen tag="SKELETON" state="LOADING" tone="faint">
          {/* A composed example — Skeleton is a bare pulsing bar; real
           * loading shapes (this one approximates a Log entry row) are
           * built from a few of them, not a fixed "skeleton variant". */}
          <SkeletonGroup label="Loading scene log" className="w-full gap-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full max-w-[28rem]" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        </Specimen>
      </div>
    </Section>
  )
}
