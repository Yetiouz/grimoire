/**
 * The closed set of named text styles (SPEC.md: "Typography is a closed
 * set"). Every screen composes text from these eight levels — no ad-hoc
 * font sizes or weights anywhere. Sizes/line-heights/tracking live as
 * theme tokens in index.css; this file is the mapping from level name to
 * the Tailwind classes that apply them.
 *
 * Three families, three jobs (see index.css for the rationale): Instrument
 * Sans (`font-sans`) for body and UI headings, Chivo Mono (`font-mono`)
 * for label/numeric — technical UI chrome, not reading content — and
 * Pirata One (`font-brand`) for `display` only, brand moments, never a
 * UI heading. `body` carries SPEC's 16px mobile floor; `label`/`numeric`
 * may go smaller because they're metadata, not reading content.
 *
 * `display` uses a responsive size pair (text-display on mobile,
 * text-display-lg from sm: up) — a short brand mark in a compact header
 * needs a smaller size than a full-width hero headline would.
 */
export const text = {
  display: 'font-brand text-display sm:text-display-lg text-ink',
  h1: 'font-sans font-semibold tracking-h1 text-h1 text-ink',
  h2: 'font-sans font-semibold tracking-h2 text-h2 text-ink',
  h3: 'font-sans font-semibold tracking-h3 text-h3 text-ink',
  body: 'font-sans text-body text-ink',
  bodySecondary: 'font-sans text-body text-ink-dim',
  label: 'font-mono text-label uppercase tracking-eyebrow text-ink-faint',
  numeric: 'font-mono tabular-nums text-numeric font-semibold text-ink',
} as const

export type TextLevel = keyof typeof text
