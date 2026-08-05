import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from './Button'
import { Panel } from './Panel'

interface ModalProps {
  title: string
  children: ReactNode
  onCancel: () => void
  onConfirm: () => void
  cancelLabel?: string
  confirmLabel?: string
  open?: boolean
  /** Style-guide-only escape hatch: skips the fixed/backdrop overlay so
   * the confirm pattern can be reviewed inline on the page instead of
   * covering it (see InputsModalsSection). Real call sites never set this. */
  inline?: boolean
  className?: string
}

/** Journal-v1 prerequisite: the confirm pattern — title, body,
 * ghost-cancel + primary action — for any destructive or consequential
 * choice. The dialog box itself is built on Panel, so it's automatically
 * consistent with every other card in the kit rather than a one-off
 * surface treatment. */
export function Modal({
  title,
  children,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  open = true,
  inline = false,
  className,
}: ModalProps) {
  if (!open) return null

  const dialog = (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <Panel className={cx('w-full max-w-sm', className)}>
        <h3 id="modal-title" className={text.h3}>
          {title}
        </h3>
        <div className={cx('mt-3', text.bodySecondary)}>{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Panel>
    </div>
  )

  if (inline) return dialog

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6"
      role="presentation"
      onClick={onCancel}
    >
      {/* Structural param type instead of React.MouseEvent — keeps this
       * file free of a React type import purely for one stopPropagation
       * call. */}
      <div onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}>{dialog}</div>
    </div>
  )
}
