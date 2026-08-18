import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'

/**
 * The rune-ring "thinking" animation (owner asset,
 * `Assets/grimoire-thinking-clockwise.svg`, added 2026-08-18) — the
 * Grimoire-branded replacement for the generic Lucide `Sparkles` spark
 * `Icon.tsx` used to render for this state (see that file's removed
 * `thinking` entry, and `JournalComposer.tsx`'s new visible thinking
 * row). Eight small rune glyphs sit at clock positions around a ring;
 * each one's opacity pulses on a staggered delay so the ring reads as
 * a single pass chasing clockwise, forever — same idea as Claude's own
 * thinking indicator, in the app's own occult-sigil language (the same
 * "arcane ring + glyph" grammar `AncestryClassArt.tsx`'s sigils
 * already use).
 *
 * Colored via `currentColor` (the source file hardcoded `stroke: #888`)
 * so callers set color the same way every other icon in this app does
 * — `style={{ color }}` or a `text-*` className — rather than this
 * component needing its own color prop.
 *
 * Class names are scoped (`grimoire-thinking-rune-*`, not the source
 * file's bare `.rune`) so the inlined `<style>` block can't collide
 * with an unrelated `.rune` class anywhere else on the page. Each
 * rendered instance carries its own copy of the same rules — real
 * duplication if this were ever mounted many times at once, but it
 * only ever renders one at a time (the composer's own thinking state),
 * so that cost is never actually paid.
 */
interface ThinkingRuneProps {
  className?: string
  style?: CSSProperties
  /** Accessible label — this is a live status, not decoration, so the
   * default is a real announcement rather than `aria-hidden`. Pass `''`
   * when a sibling element in the same live region already carries the
   * same text (avoids a double announcement) — see the composer's own
   * thinking row, which does exactly that. */
  label?: string
}

export function ThinkingRune({ className, style, label = 'Thinking' }: ThinkingRuneProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={cx('shrink-0', className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
    >
      <style>{`
        .grimoire-thinking-rune-path {
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: .22;
          animation: grimoire-thinking-pass 4.8s ease-in-out infinite;
        }
        .grimoire-thinking-rune-path:nth-child(2) { animation-delay: -4.2s; }
        .grimoire-thinking-rune-path:nth-child(3) { animation-delay: -3.6s; }
        .grimoire-thinking-rune-path:nth-child(4) { animation-delay: -3s; }
        .grimoire-thinking-rune-path:nth-child(5) { animation-delay: -2.4s; }
        .grimoire-thinking-rune-path:nth-child(6) { animation-delay: -1.8s; }
        .grimoire-thinking-rune-path:nth-child(7) { animation-delay: -1.2s; }
        .grimoire-thinking-rune-path:nth-child(8) { animation-delay: -.6s; }
        @keyframes grimoire-thinking-pass {
          0%, 28%, 100% { opacity: .22; }
          12% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .grimoire-thinking-rune-path { animation: none; opacity: .65; }
        }
      `}</style>
      <g>
        <path className="grimoire-thinking-rune-path" d="M60 23h8M64 23v12M60 29h8" />
        <path className="grimoire-thinking-rune-path" d="M89 34v12M89 37l6-3M89 41l6-3" />
        <path className="grimoire-thinking-rune-path" d="M99 60l7 4-7 4M106 60v8" />
        <path className="grimoire-thinking-rune-path" d="M91 83l5 5-5 5M96 88h-9" />
        <path className="grimoire-thinking-rune-path" d="M60 99l4 7 4-7M64 106v-12" />
        <path className="grimoire-thinking-rune-path" d="M32 88l5-5 5 5M37 83v10" />
        <path className="grimoire-thinking-rune-path" d="M29 60l-7 4 7 4M22 60v8" />
        <path className="grimoire-thinking-rune-path" d="M39 34v12M39 39l-6-5M39 39l-6 5" />
      </g>
    </svg>
  )
}
