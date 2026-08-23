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
 * Widow/orphan/rag smoothing — three passes to get here, worth recording
 * so the next attempt doesn't retread them. (1) 2026-08-17: `text-
 * balance` on h1/h2/h3 only, `text-pretty` on body/bodySecondary —
 * balance evens out short headline blocks, pretty avoids a lone
 * stranded last word on longer copy. (2) 2026-08-23, owner: "different
 * spacing on right side... rags and flags" — added `hyphens-auto` to
 * body/bodySecondary on the theory that letting long words break would
 * even out the ragged right edge. It didn't visibly help (owner: "the
 * rags are still there"): CSS `hyphens: auto` only fires for the one
 * word sitting at a line break that would otherwise leave the line
 * short, not as a general line-balancing pass, so on copy full of
 * ordinary-length words it rarely fires at all. (3) same day — tried
 * `text-justify` alongside the hyphenation, on the print-typesetting
 * logic that hyphenation is what keeps justify from producing rivers.
 * It technically worked (both edges flush) but the owner called it
 * ugly and it was reverted — CSS's justify still stretches word-spacing
 * unevenly line to line even with hyphenation helping, and on a column
 * this narrow that reads worse than a rag, not better.
 *
 * What's actually in place now: `text-balance` on body/bodySecondary
 * too, not just h1/h2/h3. Unlike `text-pretty` (which only touches the
 * last line) or `hyphens-auto`/`text-justify` (which chase individual
 * line edges), `text-wrap: balance` re-flows the whole block to
 * minimize variance across every line at once — it's the one CSS
 * technique that actually targets what "ragged" means here, without
 * introducing justify's word-spacing artifacts, because the text stays
 * left-aligned throughout. Left in place: `hyphens-auto`, since it
 * still helps balance find better break points on the rare word that
 * needs it, and it's zero-cost when it doesn't fire. Traded away:
 * `text-pretty`'s specific last-line guarantee — balance's whole-block
 * optimization makes a stranded final word rare in practice for the
 * short blocks (a class blurb, a talent line) this level is used on,
 * and Chromium/Safari both cap `balance` around 4-6 lines before
 * falling back to normal wrapping, which is exactly the length range
 * this app's body copy lives in. A future block of running text that
 * regularly exceeds that (a long journal entry) would want `pretty`
 * back instead — not a blanket call for every future use of `body`.
 * Needs `<html lang="en">` for hyphenation's dictionary — already set
 * in index.html. display/caption/label/numeric/dataDisplay stay out of
 * all of this — display never wraps, the other three are short
 * metadata values, not multi-line reading content.
 */
export const text = {
  display: 'font-brand uppercase text-display sm:text-display-lg text-ink',
  h1: 'font-heading uppercase font-normal tracking-h1 text-h1 text-ink text-balance',
  h2: 'font-heading uppercase font-normal tracking-h2 text-h2 text-ink text-balance',
  h3: 'font-heading uppercase font-normal tracking-h3 text-h3 text-ink text-balance',
  body: 'font-sans text-body text-ink text-balance hyphens-auto',
  bodySecondary: 'font-sans text-body text-ink-dim text-balance hyphens-auto',
  caption: 'font-mono text-caption',
  label: 'font-mono text-label uppercase tracking-eyebrow text-ink-faint',
  numeric: 'font-mono tabular-nums text-numeric font-semibold text-ink',
  dataDisplay: 'font-mono tabular-nums text-dataDisplay font-semibold text-ink',
} as const

export type TextLevel = keyof typeof text
