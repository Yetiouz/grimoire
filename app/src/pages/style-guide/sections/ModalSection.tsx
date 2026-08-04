import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

/** Two views of the same component: an always-visible inline preview
 * (Modal's `inline` escape hatch — see Modal.tsx) so the confirm pattern
 * is reviewable without a click, plus a real "Open modal" button wired
 * to the actual fixed/backdrop overlay so its live behavior (backdrop
 * click to cancel, real focus) can be tried. Journal-v1 prerequisite. */
export function ModalSection() {
  const [open, setOpen] = useState(false)

  return (
    <Section
      title="Modal"
      description="The confirm pattern: title, body, ghost-cancel + primary action. Built on Panel, so the dialog box is automatically consistent with every other card in the kit."
    >
      <div className="flex flex-col gap-4">
        <div>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Open modal
          </Button>
          <p className={`mt-1 ${text.caption} text-ink-faint`}>
            Real overlay — click the backdrop or Cancel to dismiss.
          </p>
        </div>
        <Modal
          title="Delete character?"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
          confirmLabel="Delete"
          open={open}
        >
          This can't be undone. Bjorn Ironhand and his sheet will be permanently removed from the campaign.
        </Modal>

        <div>
          <p className={`mb-2 ${text.caption} text-ink-faint`}>Inline preview (no backdrop, for review):</p>
          <Modal
            title="Delete character?"
            onCancel={() => {}}
            onConfirm={() => {}}
            confirmLabel="Delete"
            inline
          >
            This can't be undone. Bjorn Ironhand and his sheet will be permanently removed from the campaign.
          </Modal>
        </div>
      </div>
    </Section>
  )
}
