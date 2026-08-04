/**
 * The closed set of named text styles (SPEC.md: "Typography is a closed
 * set"). Every screen composes text from these eight levels — no ad-hoc
 * font sizes or weights anywhere. Sizes/line-heights live as --text-*
 * theme tokens in index.css; this file is the mapping from level name to
 * the Tailwind classes that apply them.
 *
 * `display` is brand-only (Pirata One) — never used for UI headings.
 * `body` carries SPEC's 16px mobile floor; `label`/`numeric` may go
 * smaller because they're metadata, not reading content.
 */
export const text = {
  display: 'font-brand text-display text-ink',
  h1: 'font-sans font-semibold text-h1 text-ink',
  h2: 'font-sans font-semibold text-h2 text-ink',
  h3: 'font-sans font-semibold text-h3 text-ink',
  body: 'font-sans text-body text-ink',
  bodySecondary: 'font-sans text-body text-ink-dim',
  label: 'font-sans text-label uppercase tracking-eyebrow text-ink-faint',
  numeric: 'font-sans tabular-nums text-numeric font-semibold text-ink',
} as const

export type TextLevel = keyof typeof text
