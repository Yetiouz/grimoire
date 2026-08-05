/**
 * The closed set of named text styles (SPEC.md: "Typography is a closed
 * set"). Every screen composes text from these ten levels — no ad-hoc
 * font sizes or weights anywhere. Sizes/line-heights/tracking live as
 * theme tokens in index.css; this file is the mapping from level name to
 * the Tailwind classes that apply them.
 *
 * Four families, four jobs (see index.css for the rationale): Instrument
 * Sans (`font-sans`) for body/UI text, Bebas Neue (`font-heading`) for
 * h1/h2/h3 headlines, Chivo Mono (`font-mono`) for label/numeric/caption/
 * dataDisplay — technical UI chrome, not reading content — and Pirata
 * One (`font-brand`) for `display` only, brand moments, never a UI
 * heading. `body` carries SPEC's 16px mobile floor; `label`/`numeric`/
 * `caption`/`dataDisplay` may go smaller because they're metadata, not
 * reading content.
 *
 * h1/h2/h3 bake in `uppercase` and `font-normal` rather than leaving
 * those per-usage: Bebas Neue is condensed and effectively caps-only by
 * design (it's what made the style-guide page's own headline work), and
 * it ships a single weight, so `font-semibold` has nothing to render
 * (the browser would just synthesize a fake bold).
 *
 * `caption` is the one level that deliberately does NOT bake in a color
 * (every other level does). It's reused across Badge, Button labels,
 * LogEntryRow's sender name/timestamp, and the Typography section's own
 * key labels — four contexts with four different color needs (an
 * arbitrary per-character hex, a button's variant-driven white/ink, a
 * muted meta color, ink itself). Baking in one default would just mean
 * overriding it everywhere; every caller sets its own color instead
 * (plain `text-*` utility where the color is fixed, inline `style` where
 * it's arbitrary per-instance data — same mechanism LogEntryRow already
 * uses for senderColor).
 *
 * `dataDisplay` is `numeric`'s bigger sibling — prominent standalone
 * readouts (a torch timer's countdown, a dice total) rather than
 * numeric's compact stat-strip values.
 *
 * `display` uses a responsive size pair (text-display on mobile,
 * text-display-lg from sm: up) — a short brand mark in a compact header
 * needs a smaller size than a full-width hero headline would. It also
 * bakes in `uppercase`, same reasoning as h1/h2/h3: the "Grimoire"
 * wordmark is always all-caps regardless of size, and that has to hold
 * structurally rather than depend on every call site typing it in caps
 * by hand (the landing page's own hero-wordmark makes the same
 * guarantee via `text-transform: uppercase` in index.html, for the same
 * reason).
 */
export const text = {
  display: 'font-brand uppercase text-display sm:text-display-lg text-ink',
  h1: 'font-heading uppercase font-normal tracking-h1 text-h1 text-ink',
  h2: 'font-heading uppercase font-normal tracking-h2 text-h2 text-ink',
  h3: 'font-heading uppercase font-normal tracking-h3 text-h3 text-ink',
  body: 'font-sans text-body text-ink',
  bodySecondary: 'font-sans text-body text-ink-dim',
  caption: 'font-mono text-caption',
  label: 'font-mono text-label uppercase tracking-eyebrow text-ink-faint',
  numeric: 'font-mono tabular-nums text-numeric font-semibold text-ink',
  dataDisplay: 'font-mono tabular-nums text-dataDisplay font-semibold text-ink',
} as const

export type TextLevel = keyof typeof text
