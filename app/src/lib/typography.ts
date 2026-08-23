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
 *
 * Widow/orphan prevention (2026-08-17) is baked into the two levels that
 * actually wrap into multiple lines of reading content: `text-balance`
 * on h1/h2/h3 (Tailwind's utility for CSS `text-wrap: balance`) evens
 * out line lengths on short headline blocks instead of leaving a
 * lopsided last line; `text-pretty` on body/bodySecondary (`text-wrap:
 * pretty`) does the equivalent job for longer running copy — talent
 * text, item descriptions, journal entries — specifically avoiding a
 * single word stranded alone on the final line. Both are no-cost
 * progressive enhancement: Chrome/Edge and Safari (26+) apply them,
 * Firefox falls back to ordinary wrapping with no breakage. display/
 * caption/label/numeric/dataDisplay are deliberately left out — display
 * is a single all-caps word that never wraps, and the other three are
 * short metadata values, not multi-line reading content.
 *
 * Rag smoothing (2026-08-23, owner: "different spacing on right side...
 * rags and flags") — `text-pretty` only fixes the LAST line of a
 * paragraph (the widow); it doesn't touch how ragged every other line's
 * right edge looks, which is its own, separate problem in the app's
 * narrow reading-content columns (a class-list blurb, an ancestry
 * talent line) — a long word can't break mid-word, so it either wraps
 * whole (leaving a much shorter line above it) or overflows. `hyphens-
 * auto` on body/bodySecondary (CSS `hyphens: auto`) fixes that: the
 * browser can now break a long word across the line boundary with a
 * hyphen when it helps the line lengths even out, which is exactly what
 * print typesetting has always paired with a ragged (non-justified)
 * right edge — full justification (`text-align: justify`) was
 * considered and rejected here, since CSS's justify algorithm just
 * stretches word-spacing with no real line-breaking optimization, and
 * on a column this narrow that reliably reads worse than a rag,
 * producing visible gaps ("rivers") rather than fixing them. Needs
 * `<html lang="en">` for the browser to pick the right hyphenation
 * dictionary — already set in index.html. Same no-cost-enhancement
 * posture as `text-pretty`/`text-balance`: Chrome, Firefox, and Safari
 * all support `hyphens: auto`, and a browser that doesn't just wraps
 * words whole exactly as it did before this line existed.
 */
export const text = {
  display: 'font-brand uppercase text-display sm:text-display-lg text-ink',
  h1: 'font-heading uppercase font-normal tracking-h1 text-h1 text-ink text-balance',
  h2: 'font-heading uppercase font-normal tracking-h2 text-h2 text-ink text-balance',
  h3: 'font-heading uppercase font-normal tracking-h3 text-h3 text-ink text-balance',
  body: 'font-sans text-body text-ink text-pretty hyphens-auto',
  bodySecondary: 'font-sans text-body text-ink-dim text-pretty hyphens-auto',
  caption: 'font-mono text-caption',
  label: 'font-mono text-label uppercase tracking-eyebrow text-ink-faint',
  numeric: 'font-mono tabular-nums text-numeric font-semibold text-ink',
  dataDisplay: 'font-mono tabular-nums text-dataDisplay font-semibold text-ink',
} as const

export type TextLevel = keyof typeof text
