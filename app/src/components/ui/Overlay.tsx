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
 * it. Maps and Dice (both listed on the vision-handoff mockup, not yet
 * built) share this same primitive when their slices land.
 *
 * Closes on Escape or a backdrop click, matching the mockup's own
 * `keydown`/`onclick` handlers exactly.
 */
export function Overlay({ open, onClose, header, children, width = 'default', className }: OverlayProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/75 p-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'max-h-[88vh] w-full overflow-y-auto rounded-card border border-line bg-panel p-6',
          width === 'narrow' ? 'max-w-[460px]' : 'max-w-[880px]',
          className,
        )}
        // Structural param type instead of React.MouseEvent, same
        // pattern Modal already uses — keeps this file free of a React
        // type import purely for one stopPropagation call.
        onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-line-soft pb-3">
          {header}
          <button
            onClick={onClose}
            className={cx(
              text.caption,
              'shrink-0 rounded-lg border border-line px-3 py-2 uppercase tracking-eyebrow text-ink-faint hover:border-line-hover hover:text-ink',
            )}
          >
            Close · Esc
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
