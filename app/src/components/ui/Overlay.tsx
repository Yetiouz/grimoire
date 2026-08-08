import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface OverlayProps {
  open: boolean
  onClose: () => void
  /** The sheet-head's left-side content (title + meta line) — full
   * `ReactNode`, not a plain string, since `CharacterSheet`'s header is
   * a name plus a class/XP/gold meta line, not just a heading. The close
   * button lives on the right, rendered by Overlay itself. */
  header: ReactNode
  children: ReactNode
  /** `player-view-mockup.html`'s `.sheet` is 880px; `.sheet.narrow`
   * (used there for the Dice overlay) is 460px. Sheet/Maps content use
   * the default; a future narrow overlay (e.g. Dice) would pass this. */
  width?: 'default' | 'narrow'
  /**
   * Panel shape/position (mobile layout slice). `'dialog'` (default) is
   * the original centered-modal treatment, unchanged, and is what every
   * caller still gets at `xl:` and up regardless of which variant is
   * picked — `'sheet'` and `'slideUp'` only change how the SAME overlay
   * presents *below* `xl:`, per `mobile-view-mockup.html`. No JS
   * breakpoint detection: the switch is pure Tailwind `xl:` classes,
   * the same mechanism every other responsive decision in this app
   * already uses.
   *
   * `'sheet'`: a compact panel that stays vertically centered and
   * near-full-width on mobile — DiceRoller's presentation. It was
   * originally bottom-anchored (a literal bottom sheet); the owner
   * asked for centered instead, so the name now means "compact panel"
   * rather than "bottom sheet".
   *
   * `'slideUp'`: mobile full-screen page, no rounding/border/max-width
   * cap — CharacterSheet's mobile presentation, per the mobile-vision
   * entry's "a sheet is studied, not glanced" call.
   *
   * Whichever variant is picked, the header is now always pinned and
   * only the body scrolls beneath it (previously the whole panel,
   * header included, scrolled as one block). This is a byproduct of
   * building `'slideUp'` — a full-screen sheet needs its close control
   * reachable without scrolling back to the top — but it's a strict
   * improvement for `'dialog'` too (a header no longer disappears
   * upstream of long content), so it applies to all three rather than
   * forking the internal structure per variant.
   */
  variant?: 'dialog' | 'sheet' | 'slideUp'
  className?: string
}

/**
 * Full-screen overlay primitive matching `player-view-mockup.html`'s
 * `.overlay`/`.overlay.open` + `.sheet` pattern — a dark blurred
 * backdrop behind a centered, scrollable panel. Built fresh rather than
 * reusing `Modal` (per the "from the latest mockup" resolution to this
 * slice's open question): `Modal` is the small title/body/confirm-or-
 * cancel dialog pattern, and forcing the Sheet's much larger scrollable
 * content through it would mean fighting that shape rather than reusing
 * it. Maps (still unbuilt) would share this same primitive when its
 * slice lands.
 *
 * Closes on Escape or a backdrop click, matching the mockup's own
 * `keydown`/`onclick` handlers exactly. No entrance/exit transition
 * (mount/unmount is a plain conditional render, same as every other
 * overlay in this app) — the mobile mockup's slide-up/slide-in motion
 * is deliberately not built this pass; see the mobile-layout slice's
 * "what this will not build" list.
 */
export function Overlay({ open, onClose, header, children, width = 'default', variant = 'dialog', className }: OverlayProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const widthClass = width === 'narrow' ? 'xl:max-w-[460px]' : 'xl:max-w-[880px]'

  // `'sheet'` centers vertically on mobile rather than sitting on the
  // viewport's bottom edge (owner's call — a bottom-anchored roller
  // read as "smashed to the bottom"). Only `'slideUp'`, which is
  // full-height anyway, still anchors to the bottom edge.
  const backdropAlignClass =
    variant === 'slideUp'
      ? 'items-end justify-center p-0 xl:items-center xl:justify-center xl:p-6'
      : variant === 'sheet'
        ? 'items-center justify-center p-4 xl:p-6'
        : 'items-center justify-center p-6'

  const panelShapeClass =
    variant === 'slideUp'
      ? cx('h-[100dvh] max-h-[100dvh] rounded-none border-0 xl:h-auto xl:max-h-[88vh] xl:rounded-card xl:border xl:border-line', widthClass)
      : variant === 'sheet'
        ? cx('max-h-[85vh] rounded-card border border-line xl:max-h-[88vh]', widthClass)
        : cx('max-h-[88vh] rounded-card border border-line', widthClass)

  return (
    <div
      className={cx('fixed inset-0 z-50 flex bg-bg/75 backdrop-blur-sm', backdropAlignClass)}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx('flex w-full flex-col overflow-hidden bg-panel', panelShapeClass, className)}
        // Structural param type instead of React.MouseEvent, same
        // pattern Modal already uses — keeps this file free of a React
        // type import purely for one stopPropagation call.
        onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-baseline justify-between gap-4 border-b border-line-soft px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
          {header}
          <button
            onClick={onClose}
            className={cx(
              text.caption,
              'inline-flex min-h-11 shrink-0 items-center rounded-lg border border-line px-3 uppercase tracking-eyebrow text-ink-faint hover:border-line-hover hover:text-ink',
            )}
          >
            Close<span className="hidden sm:inline"> · Esc</span>
          </button>
        </div>
        {/* `min-h-0` (bug fix): a `flex-1` child in a flex column
         * defaults to `min-height: auto`, which means it won't actually
         * shrink below its own content's height — so `overflow-y-auto`
         * here never had anything to scroll, and the panel's own
         * `max-h-[85vh]`/`overflow-hidden` was hard-clipping whatever
         * didn't fit instead, with no scrollbar and nothing peeking
         * through. That's what read as the roll result and the Roll
         * Again/Log buttons "not showing up" on a real phone once the
         * Die/Count/Mode/Modifier controls plus a settled result no
         * longer fit in 85vh. `min-h-0` lets this box actually shrink
         * to the space the header leaves it, which is what makes
         * `overflow-y-auto` engage at all. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
