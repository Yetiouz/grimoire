import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

export type SectionGroup = 'Foundation' | 'Components'

interface SectionProps {
  /** Anchor id — must match the matching entry in StyleGuide.tsx's INDEX
   * array so the sticky Index's links and scroll-spy resolve to this
   * section. Kebab-case, `sec-` prefixed (styleguide-mockup.html's own
   * convention). */
  id: string
  /** Zero-padded three-digit position, e.g. "004" — printed in the
   * eyebrow as "004 // FOUNDATION". Kept as a plain string (not derived)
   * so a section can be reordered without renumbering everything else in
   * one edit. */
  number: string
  group: SectionGroup
  title: string
  description: string
  children: ReactNode
}

/** Shared section shell: numbered eyebrow + Bebas title + description,
 * sitting on a hairline divider (styleguide-mockup.html's `.sec-head`),
 * then whatever specimen content the caller renders below. Page-local —
 * not part of the reusable UI kit. `scroll-mt` keeps the anchor target
 * from landing flush against the viewport edge when jumped to from the
 * Index. */
export function Section({ id, number, group, title, description, children }: SectionProps) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1.5 border-b border-line-soft pb-3">
        <p className={cx(text.caption, 'uppercase tracking-eyebrow text-purple')}>
          {number} // {group.toUpperCase()}
        </p>
        <h2 className={text.h2}>{title}</h2>
        <p className={cx(text.bodySecondary, 'max-w-[60ch]')}>{description}</p>
      </div>
      {children}
    </section>
  )
}
