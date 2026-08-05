import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

const CONTAINER = 'mx-auto max-w-[65rem] px-6'

/** Closing hairline bar (styleguide-mockup.html's `.footer-line`) —
 * shares the same container width as the masthead and shell so its
 * edges align with everything above it. */
export function Footer() {
  return (
    <div className="border-t border-line">
      <div className={cx(CONTAINER, 'flex justify-between py-5', text.label)}>
        <span>Grimoire design system</span>
        <span>Spec sheet — rendered from live tokens</span>
      </div>
    </div>
  )
}
