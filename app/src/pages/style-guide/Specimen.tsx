import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

/** Colors the state indicator can render in. 'green' is the default —
 * styleguide-mockup.html uses green as its generic "this is the state
 * shown, rendering normally" signal (its DEFAULT and LIVE tags are both
 * green). We override to a more specific tone when the label itself
 * names one: 'faint' for DISABLED/STATIC (de-emphasized), or a tone that
 * matches what the specimen is actually demonstrating (e.g. DANGER_RED,
 * an ACCENT_ORANGE torch timer) so the tag communicates something real
 * instead of always defaulting to green. */
export type SpecimenTone = 'green' | 'purple' | 'red' | 'orange' | 'yellow' | 'cyan' | 'faint'

const toneClass: Record<SpecimenTone, string> = {
  green: 'text-green',
  purple: 'text-purple',
  red: 'text-red',
  orange: 'text-orange',
  yellow: 'text-yellow',
  cyan: 'text-cyan',
  faint: 'text-ink-faint',
}

interface SpecimenProps {
  /** Mono identifier, e.g. "BTN_PRIMARY" — styleguide-mockup.html's
   * `cell-tag` pattern. Not a real code symbol, just a readable handle
   * for the specimen. */
  tag: string
  state: string
  tone?: SpecimenTone
  children: ReactNode
  className?: string
}

/** A single labeled specimen cell: mono tag + state indicator up top,
 * the actual rendered component below (styleguide-mockup.html's
 * `.spec-cell`). Page-local composition only — wraps existing UI-kit
 * components, never changes them. */
export function Specimen({ tag, state, tone = 'green', children, className }: SpecimenProps) {
  return (
    <div className={cx('flex flex-col items-start gap-3 rounded-card border border-line bg-panel p-5', className)}>
      <div className={cx('flex w-full items-center justify-between gap-3', text.caption, 'uppercase tracking-eyebrow text-ink-faint')}>
        <span>{tag}</span>
        <span className={toneClass[tone]}>{state}</span>
      </div>
      {children}
    </div>
  )
}

const gridColsClass: Record<2 | 3, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
}

/** Responsive grid for a row of Specimen cells (styleguide-mockup.html's
 * `.spec-grid`, which is always 2-up) — `gap-2` (8px, "related") per the
 * ratified spacing scale. `cols` picks the sm:+ column count from a
 * lookup rather than letting a caller pass a second `sm:grid-cols-*`
 * utility via `className`: two same-breakpoint utilities of equal
 * specificity have unreliable cascade order in this project's Tailwind
 * v4 setup (Tailwind's generated order, not className string order,
 * decides which wins) — the same reason the kit's components use inline
 * `style` instead of a second class for other one-property overrides. */
export function SpecimenGrid({
  children,
  className,
  cols = 2,
}: {
  children: ReactNode
  className?: string
  cols?: 2 | 3
}) {
  return <div className={cx('grid grid-cols-1 gap-2', gridColsClass[cols], className)}>{children}</div>
}
