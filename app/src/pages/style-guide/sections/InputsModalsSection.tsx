import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { TextInput } from '../../../components/ui/TextInput'
import { cx } from '../../../lib/cx'
import { text } from '../../../lib/typography'
import { Section } from '../Section'
import { Specimen, SpecimenGrid } from '../Specimen'

/** Text input and Modal merged into one numbered section
 * (styleguide-mockup.html's "009 Inputs & Modals") — two separate
 * style-guide sections before this rebuild; TextInput.tsx and Modal.tsx
 * themselves are untouched, only how their demos are composed here. */
export function InputsModalsSection() {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <Section
      id="sec-inputs"
      number="014"
      group="Components"
      title="Inputs & Modals"
      description="Journal-v1 prerequisites. Text input: 16px text — SPEC's mobile-minimum floor, which not-coincidentally also stops iOS Safari from auto-zooming a field on focus. Modal: the confirm pattern — title, body, ghost-cancel + primary action, built on Panel."
    >
      <div className="flex flex-col gap-3">
        <p className={text.label}>Text input</p>
        <SpecimenGrid cols={3}>
          <Specimen tag="TEXT_INPUT" state="DEFAULT">
            <TextInput
              label="Character name"
              placeholder="Bjorn Ironhand"
              value={value}
              onChange={(event: { target: { value: string } }) => setValue(event.target.value)}
              className="w-full"
            />
          </Specimen>
          <Specimen tag="TEXT_INPUT" state="FOCUS" tone="purple">
            <div className="w-full">
              <TextInput
                label="Character name"
                placeholder="Bjorn Ironhand"
                className="w-full border-purple ring-2 ring-purple/50"
              />
              <p className={cx('mt-1', text.caption, 'text-ink-faint')}>Simulated — click the field above for the real thing.</p>
            </div>
          </Specimen>
          <Specimen tag="TEXT_INPUT" state="ERROR" tone="red">
            <TextInput
              label="Character name"
              placeholder="Bjorn Ironhand"
              error="Name is required."
              className="w-full"
            />
          </Specimen>
        </SpecimenGrid>
      </div>

      <div className="flex flex-col gap-3">
        <p className={cx('mt-2', text.label)}>Modal</p>
        <SpecimenGrid>
          <Specimen tag="MODAL" state="TRIGGER">
            <div>
              <Button variant="ghost" onClick={() => setOpen(true)}>
                Open modal
              </Button>
              <p className={cx('mt-1', text.caption, 'text-ink-faint')}>
                Real overlay — click the backdrop or Cancel to dismiss.
              </p>
              <Modal
                title="Delete character?"
                onCancel={() => setOpen(false)}
                onConfirm={() => setOpen(false)}
                confirmLabel="Delete"
                open={open}
              >
                This can't be undone. Bjorn Ironhand and his sheet will be permanently removed from the campaign.
              </Modal>
            </div>
          </Specimen>
          <Specimen tag="MODAL" state="INLINE_PREVIEW" tone="faint">
            <Modal
              title="Delete character?"
              onCancel={() => {}}
              onConfirm={() => {}}
              confirmLabel="Delete"
              inline
              className="w-full"
            >
              This can't be undone. Bjorn Ironhand and his sheet will be permanently removed from the campaign.
            </Modal>
          </Specimen>
        </SpecimenGrid>
      </div>
    </Section>
  )
}
