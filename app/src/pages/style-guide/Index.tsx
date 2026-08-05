import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

export interface IndexEntry {
  id: string
  number: string
  label: string
}

interface IndexProps {
  entries: IndexEntry[]
}

/** Sticky side index (styleguide-mockup.html's `.index`): real anchors —
 * smooth-scrolled via the global `scroll-behavior: smooth` in
 * index.css, not JS — plus a scroll-spy highlight driven by
 * IntersectionObserver, same mechanism the mockup uses. Hidden under
 * 800px (the mockup's own breakpoint, not one of Tailwind's named
 * ones — `min-[800px]:` is an arbitrary-value variant, not a new
 * design token). Page-local — not part of the UI kit. */
export function Index({ entries }: IndexProps) {
  const [activeId, setActiveId] = useState(entries[0]?.id)

  useEffect(() => {
    const targets = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const observerEntry of observerEntries) {
          if (observerEntry.isIntersecting) {
            setActiveId(observerEntry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [entries])

  return (
    <nav
      aria-label="Section index"
      className="sticky top-0 hidden max-h-screen flex-col gap-0.5 self-start overflow-y-auto py-12 min-[800px]:flex"
    >
      <p className={cx(text.label, 'mb-3')}>Index</p>
      {entries.map(({ id, number, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={activeId === id ? 'true' : undefined}
          className={cx(
            'rounded-md px-2 py-1.5 tracking-wide',
            text.caption,
            activeId === id ? 'bg-panel text-purple' : 'text-ink-dim hover:bg-panel hover:text-ink',
          )}
        >
          {number} · {label}
        </a>
      ))}
    </nav>
  )
}
