import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

/**
 * Sigil marks for the Character Builder's Ancestry and Class choice
 * cards (2026-08-16, third pass — owner approved the sigil direction
 * after rejecting both hand-drawn pictograms, "some of these look like
 * a child's drawing", and icon-library silhouettes, "more icons I
 * hate"; see sigil-exploration.html / the "grimoire-icon-style-
 * exploration" artifact for the approved mockup).
 *
 * The premise: small PICTURES of a dwarf either read childish (amateur
 * vectors) or generic (clipart) — so these aren't pictures. Each
 * ancestry/class gets an occult geometric sigil in a consistent
 * grammar: a faint arcane ring, one ruler-and-compass construction,
 * and a filled focus dot, glowing in the subject's accent color.
 * Occult like the book, neon like the app.
 *
 * Keyed by the rules module's own `key` strings (`lib/rules/
 * shadowdark.ts`); an unknown key renders the anonymous fallback mark
 * rather than nothing, so a future system's entries are never bare.
 * Each sigil is ~4 lines of geometry — the owner expects to iterate on
 * individual marks ("I may come up with stuff later"), and a swap
 * touches exactly one map entry.
 */

interface Sigil {
  color: string
  /** Inner SVG nodes on the shared 48×48 grid. Stroke color/width/caps
   * inherit from the <svg> root; `opacity` marks faint construction
   * lines; focus dots set `fill` explicitly (root is fill:none). */
  nodes: ReactNode
}

/** The shared faint arcane ring most sigils sit inside. */
const RING = <circle cx="24" cy="24" r="19" opacity={0.35} />

const ANCESTRY_SIGILS: Record<string, Sigil> = {
  // Mountain-anvil: peak, bar, and a setting star.
  dwarf: {
    color: 'var(--color-orange)',
    nodes: (
      <>
        {RING}
        <path d="M12 30L24 12l12 18z" />
        <path d="M16 30h16M24 30v7" />
        <circle cx="24" cy="21" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Vesica leaf split by the true line.
  elf: {
    color: 'var(--color-cyan)',
    nodes: (
      <>
        {RING}
        <path d="M24 8v32" />
        <path d="M24 40C13 34 13 20 24 8c11 12 11 26 0 32z" />
        <circle cx="24" cy="16" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Eared shard — a listening stone.
  goblin: {
    color: 'var(--color-green)',
    nodes: (
      <>
        {RING}
        <path d="M24 14l9 9-9 11-9-11z" />
        <path d="M15 23L8 12M33 23l7-11" />
        <circle cx="24" cy="25" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Tusk arc — the mighty rise.
  'half-orc': {
    color: 'var(--color-red)',
    nodes: (
      <>
        {RING}
        <path d="M14 34c0-9 3-15 10-20 7 5 10 11 10 20" />
        <path d="M14 34l-4 4M34 34l4 4" />
        <path d="M19 25h10" />
      </>
    ),
  },
  // Hearth ring — the small circle carries the fire.
  halfling: {
    color: 'var(--color-yellow)',
    nodes: (
      <>
        <circle cx="24" cy="21" r="15" opacity={0.35} />
        <circle cx="24" cy="30" r="8" />
        <circle cx="24" cy="30" r="2" fill="currentColor" stroke="none" />
        <path d="M24 6v7M17 9l3 5M31 9l-3 5" />
      </>
    ),
  },
  // Ambition rune — the arrow past its own ground line.
  human: {
    color: 'var(--color-purple)',
    nodes: (
      <>
        {RING}
        <path d="M24 5v38M24 5l7 7M24 5l-7 7" />
        <path d="M14 34h20" />
      </>
    ),
  },
}

const CLASS_SIGILS: Record<string, Sigil> = {
  // Crossed edge.
  fighter: {
    color: 'var(--color-red)',
    nodes: (
      <>
        {RING}
        <path d="M11 11l26 26M37 11L11 37" />
        <path d="M11 11l6 1-1 6zM37 11l-6 1 1 6z" />
        <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Double cross.
  priest: {
    color: 'var(--color-yellow)',
    nodes: (
      <>
        {RING}
        <path d="M24 7v34M15 16h18M18 24h12" />
        <circle cx="24" cy="7" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Waning moon.
  thief: {
    color: 'var(--color-green)',
    nodes: (
      <>
        {RING}
        <path d="M31 8a17 17 0 1 0 9 15A13 13 0 0 1 31 8z" />
        <circle cx="31" cy="26" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Eight-fold star.
  wizard: {
    color: 'var(--color-purple)',
    nodes: (
      <>
        {RING}
        <path d="M24 6v36M6 24h36M11 11l26 26M37 11L11 37" />
        <circle cx="24" cy="24" r="4" />
      </>
    ),
  },
  // Horned drop — the demon's bargain.
  'knight-of-st-ydris': {
    color: 'var(--color-pink)',
    nodes: (
      <>
        {RING}
        <path d="M12 14l12 26 12-26z" />
        <circle cx="24" cy="22" r="2" fill="currentColor" stroke="none" />
        <path d="M12 14l-3-5M36 14l3-5" />
      </>
    ),
  },
  // Horned pact circle.
  warlock: {
    color: 'var(--color-pink)',
    nodes: (
      <>
        <circle cx="24" cy="28" r="12" />
        <path d="M12 24C9 17 9 11 12 6c4 3 6 7 7 12M36 24c3-7 3-13 0-18-4 3-6 7-7 12" />
        <circle cx="24" cy="28" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Triple moon.
  witch: {
    color: 'var(--color-purple)',
    nodes: (
      <>
        <path d="M14 24a10 10 0 1 0 5-8.5A12 12 0 0 1 14 24z" />
        <circle cx="30" cy="24" r="7" />
        <path d="M41 16a12 12 0 0 0-5 8.5" opacity={0.35} />
        <circle cx="30" cy="24" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Sun over dunes.
  'desert-rider': {
    color: 'var(--color-orange)',
    nodes: (
      <>
        <circle cx="24" cy="19" r="9" />
        <path d="M24 6v4M13 8l3 4M35 8l-3 4M8 19h5M35 19h5" />
        <path d="M6 36c5-5 9-5 13-1s9 4 13-1" />
        <circle cx="24" cy="19" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // The pit, seen from above.
  'pit-fighter': {
    color: 'var(--color-red)',
    nodes: (
      <>
        {RING}
        <path d="M15 15h18v18H15z" />
        <path d="M20 10v10M28 10v10M20 28v10M28 28v10M10 20h10M10 28h10M28 20h10M28 28h10" opacity={0.35} />
        <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Smoke cut.
  'ras-godai': {
    color: 'var(--color-green)',
    nodes: (
      <>
        {RING}
        <path d="M10 38C22 30 26 18 38 10" />
        <path d="M14 20c2-6 6-10 12-12M34 28c-2 6-6 10-12 12" opacity={0.35} />
        <circle cx="38" cy="10" r="1.8" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Trident rune.
  'sea-wolf': {
    color: 'var(--color-cyan)',
    nodes: (
      <>
        {RING}
        <path d="M24 10v22M15 14v10a9 9 0 0 0 18 0V14" />
        <path d="M17 38h14" />
      </>
    ),
  },
  // Open eye.
  seer: {
    color: 'var(--color-cyan)',
    nodes: (
      <>
        <path d="M6 24C13 14 35 14 42 24 35 34 13 34 6 24z" />
        <circle cx="24" cy="24" r="6" />
        <circle cx="24" cy="24" r="1.8" fill="currentColor" stroke="none" />
        <path d="M24 8v5M24 35v5" opacity={0.35} />
      </>
    ),
  },
}

/** Anonymous mark for a key neither map knows — a faint ring holding a
 * faint nameless peak. Renders in the neutral faint tone so an
 * unmapped entry is visibly "unmarked" rather than wearing some other
 * subject's sigil. */
const FALLBACK: Sigil = {
  color: 'var(--color-ink-faint)',
  nodes: (
    <>
      {RING}
      <path d="M18 30l6-12 6 12" opacity={0.35} />
    </>
  ),
}

interface ArtProps {
  /** The rules module's own key for this ancestry/class. */
  k: string
  /** Ghost mode: the big faint background sigil the choice cards layer
   * behind their text (see CharacterBuilder) — no glow, no own opacity
   * (the caller's wrapper sets it, so one wrapper class tunes every
   * card at once). */
  ghost?: boolean
  className?: string
}

function SigilSvg({ sigil, ghost = false, className }: { sigil: Sigil; ghost?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('shrink-0', className)}
      style={{
        color: sigil.color,
        filter: ghost ? undefined : `drop-shadow(0 0 5px color-mix(in srgb, ${sigil.color} 60%, transparent))`,
      }}
      aria-hidden="true"
    >
      {sigil.nodes}
    </svg>
  )
}

export function AncestryArt({ k, ghost, className }: ArtProps) {
  return <SigilSvg sigil={ANCESTRY_SIGILS[k] ?? FALLBACK} ghost={ghost} className={className} />
}

export function ClassArt({ k, ghost, className }: ArtProps) {
  return <SigilSvg sigil={CLASS_SIGILS[k] ?? FALLBACK} ghost={ghost} className={className} />
}
