import type { ReactNode } from 'react'
import { text } from '../../lib/typography'

interface SectionProps {
  title: string
  description: string
  children: ReactNode
}

/** Shared heading + description wrapper so each component's showcase
 * section (below) doesn't repeat the same markup. Page-local — not part
 * of the reusable UI kit. Uses the closed-set typography levels (h2 /
 * bodySecondary) rather than ad-hoc classes, per SPEC's typography rule. */
export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={text.h2}>{title}</h2>
        <p className={`mt-1 ${text.bodySecondary}`}>{description}</p>
      </div>
      {children}
    </section>
  )
}
