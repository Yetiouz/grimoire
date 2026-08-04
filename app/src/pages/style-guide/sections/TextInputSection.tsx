import { useState } from 'react'
import { TextInput } from '../../../components/ui/TextInput'
import { text } from '../../../lib/typography'
import { Section } from '../Section'

/** Every state: default (real, click into it to try focus for real),
 * focus (statically forced so the ring/border are visible without a
 * click — same "simulated state" pattern Panel's interactive hover
 * note uses), and error. Journal-v1 prerequisite. */
export function TextInputSection() {
  const [value, setValue] = useState('')

  return (
    <Section
      title="Text input"
      description="16px text — SPEC's mobile-minimum floor, which not-coincidentally also stops iOS Safari from auto-zooming a field on focus. Default, focus, and error states."
    >
      <div className="flex flex-col gap-4 sm:max-w-sm">
        <TextInput
          label="Character name"
          placeholder="Bjorn Ironhand"
          value={value}
          onChange={(event: { target: { value: string } }) => setValue(event.target.value)}
        />
        <div>
          <TextInput label="Character name (focus)" placeholder="Bjorn Ironhand" className="border-purple ring-2 ring-purple/50" />
          <p className={`mt-1 ${text.caption} text-ink-faint`}>Simulated — click the field above for the real thing.</p>
        </div>
        <TextInput label="Character name" placeholder="Bjorn Ironhand" error="Name is required." />
      </div>
    </Section>
  )
}
