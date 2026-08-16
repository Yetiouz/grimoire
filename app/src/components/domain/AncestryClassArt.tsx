import type { ReactNode } from 'react'

/**
 * Choice-card pictograms for the Character Builder's Ancestry and Class
 * steps (2026-08-16, owner + playtest feedback: "races need visuals on
 * what they are" — a first-time player recognizes a mark faster than
 * she reads a name; style approved via ancestry-art-mockup.html).
 *
 * Hand-drawn 24×24 stroke paths in the app's own accent palette rather
 * than lucide: no icon library ships a goblin. Same 1.7 stroke weight
 * across every glyph so the set reads as one hand. Colors reference the
 * `--color-*` theme tokens directly (each mark's hue is per-glyph data,
 * not a component state — the same "arbitrary runtime color" reasoning
 * `senderColor` uses in LogEntryRow).
 *
 * Keyed by the rules module's own `key` strings (`lib/rules/
 * shadowdark.ts`), with `null` for a key this file doesn't know — a
 * future system's ancestries simply render cardless-art until glyphs
 * are added here, nothing breaks. Every glyph is one map entry: easy to
 * swap any single one that doesn't land (owner's proviso when the
 * style was approved).
 */

const ANCESTRY_ART: Record<string, { color: string; paths: ReactNode }> = {
  dwarf: {
    color: 'var(--color-orange)',
    paths: (
      <>
        <path d="M13 9l-8 8 2 2 8-8" />
        <path d="M12 4c2-2 6-2 8 0-2 .5-2.5 1-3 3 3 .5 4 2 4 4-2-1.5-4-1.5-6-.5L12 8c-1-2-1-3 0-4z" />
      </>
    ),
  },
  elf: {
    color: 'var(--color-cyan)',
    paths: (
      <>
        <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z" />
        <path d="M4 20C9 15 13 11 17 7" />
      </>
    ),
  },
  goblin: {
    color: 'var(--color-green)',
    paths: (
      <>
        <circle cx="12" cy="14" r="5" />
        <path d="M8 11L2.5 5.5C6 5.5 8.5 7 9.5 9.5M16 11l5.5-5.5C18 5.5 15.5 7 14.5 9.5" />
        <path d="M10 14h.01M14 14h.01" strokeLinecap="round" strokeWidth={2.2} />
      </>
    ),
  },
  'half-orc': {
    color: 'var(--color-red)',
    paths: (
      <>
        <path d="M4 21c0-5 2-8 5-10M20 21c0-5-2-8-5-10" />
        <path d="M9 11c-1.5-2-2-5-1-8 1.5 2 2 3 4 3s2.5-1 4-3c1 3 .5 6-1 8" />
        <path d="M9 11h6" />
      </>
    ),
  },
  halfling: {
    color: 'var(--color-yellow)',
    paths: (
      <>
        <path d="M12 12c-1-4 1-7 4-8 1 3 0 6-4 8zM12 12c1-4-1-7-4-8-1 3 0 6 4 8zM12 12c4-1 7 1 8 4-3 1-6 0-8-4zM12 12c-4-1-7 1-8 4 3 1 6 0 8-4z" />
        <path d="M12 12c0 4 1 6 3 8" />
      </>
    ),
  },
  human: {
    color: 'var(--color-purple)',
    paths: (
      <>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M4.5 21c.5-5 3.5-8 7.5-8s7 3 7.5 8" />
      </>
    ),
  },
}

const CLASS_ART: Record<string, { color: string; paths: ReactNode }> = {
  fighter: {
    color: 'var(--color-red)',
    paths: (
      <>
        <path d="M14.5 3H21v6.5L9 21.5 2.5 15z" />
        <path d="M3 21l4-4M21 9.5L9.5 21" />
      </>
    ),
  },
  priest: {
    color: 'var(--color-yellow)',
    paths: <path d="M12 3v18M6 9h12" />,
  },
  thief: {
    color: 'var(--color-green)',
    paths: (
      <>
        <path d="M12 3l1.8 4.5L12 20l-1.8-12.5z" />
        <path d="M7.5 8h9M12 20v1.5" />
      </>
    ),
  },
  wizard: {
    color: 'var(--color-purple)',
    paths: (
      <>
        <path d="M4 20L15 5" />
        <path
          d="M17.5 2.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM20 10l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
  },
  // Expansion classes (Cursed Scrolls) — same hand, one glyph each so
  // no card in the grid ever renders bare next to an illustrated one.
  'knight-of-st-ydris': {
    color: 'var(--color-pink)',
    paths: (
      <>
        <path d="M12 3l7 2.5v5c0 4.5-3 8.5-7 10.5-4-2-7-6-7-10.5v-5z" />
        <path d="M12 7v7M9 10.5h6" />
      </>
    ),
  },
  warlock: {
    color: 'var(--color-pink)',
    paths: (
      <>
        <path d="M5 4c0 4 1.5 6.5 4 8M19 4c0 4-1.5 6.5-4 8" />
        <path d="M12 21c-3 0-5-2-5-5 0-2.5 2-4.5 5-4.5s5 2 5 4.5c0 3-2 5-5 5z" />
        <path d="M10.5 15.5h.01M13.5 15.5h.01" strokeLinecap="round" strokeWidth={2.2} />
      </>
    ),
  },
  witch: {
    color: 'var(--color-purple)',
    paths: (
      <>
        <path d="M3.5 18h17c-2-1.5-3-2.5-3.5-4L14 5l-4 1-2.5 8c-.5 1.5-2 2.5-4 4z" />
        <path d="M8 18c2.5 1 5.5 1 8 0" />
      </>
    ),
  },
  'desert-rider': {
    color: 'var(--color-orange)',
    paths: (
      <>
        <circle cx="12" cy="9" r="4" />
        <path d="M12 2v1.5M18.5 4.5l-1 1M21 11h-1.5M5.5 4.5l1 1M3 11h1.5" />
        <path d="M2 19c3-3 6-3 10-1s7 2 10-1" />
      </>
    ),
  },
  'pit-fighter': {
    color: 'var(--color-red)',
    paths: (
      <>
        <path d="M6 12V8.5a2 2 0 014 0V12M10 10.5V7a2 2 0 014 0v3.5M14 10.5V8a2 2 0 014 0v6c0 4-2.5 7-6.5 7S6 18 6 15v-3" />
      </>
    ),
  },
  'ras-godai': {
    color: 'var(--color-green)',
    paths: (
      <>
        <path d="M8 21c-2-3-2-6 0-9s2-6 0-9c4 2 6 5 6 9s-2 7-6 9z" />
        <path d="M16 16c2-1 3.5-2.5 4.5-4.5" />
      </>
    ),
  },
  'sea-wolf': {
    color: 'var(--color-cyan)',
    paths: (
      <>
        <path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
        <path d="M2 19.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
        <path d="M7 11c1-4 4-6.5 8-7-1 2-1 3.5 0 5.5" />
      </>
    ),
  },
  seer: {
    color: 'var(--color-cyan)',
    paths: (
      <>
        <path d="M2.5 12C5 7.5 8 5.5 12 5.5s7 2 9.5 6.5c-2.5 4.5-5.5 6.5-9.5 6.5s-7-2-9.5-6.5z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
}

interface ArtProps {
  /** The rules module's own key for this ancestry/class. */
  k: string
  className?: string
}

function Art({ entry, className }: { entry: { color: string; paths: ReactNode } | undefined; className?: string }) {
  if (!entry) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      className={className}
      style={{ color: entry.color }}
      aria-hidden="true"
    >
      {entry.paths}
    </svg>
  )
}

export function AncestryArt({ k, className }: ArtProps) {
  return <Art entry={ANCESTRY_ART[k]} className={className} />
}

export function ClassArt({ k, className }: ArtProps) {
  return <Art entry={CLASS_ART[k]} className={className} />
}
