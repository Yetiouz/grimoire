import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  description: string
  children: ReactNode
}

/** Shared heading + description wrapper so each component's showcase
 * section (below) doesn't repeat the same markup. Page-local — not part
 * of the reusable UI kit. */
export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-dim">{description}</p>
      </div>
      {children}
    </section>
  )
}
