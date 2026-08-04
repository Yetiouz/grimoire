import { Button } from '../../../components/ui/Button'
import { Section } from '../Section'

export function ButtonSection() {
  return (
    <Section
      title="Button"
      description="Primary and ghost variants. Radius is deliberately rounded-button (11px), not full-round — buttons read as buttons; pills (see Badge) read as tags. If that reads wrong side by side, this is the page to judge it from, not an argument."
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" disabled>
          Primary disabled
        </Button>
        <Button variant="ghost" disabled>
          Ghost disabled
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Tab to a button to see the focus ring — a keyboard-only affordance not in the original landing page.
      </p>
    </Section>
  )
}
