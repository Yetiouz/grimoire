import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface TalentRowProps {
  /** Freeform talent description straight from `characters.sheet.
   * attacks_talents` — the imported sheets don't carry structured
   * source/uses-remaining data (`player-view-mockup.html`'s `.rowline`
   * shows a "3/3 left" counter and a "Class · L1" source tag, neither
   * of which exists in the real data), so this renders the description
   * text only rather than fabricating either. */
  label: string
  className?: string
}

/** One row in a character's Talents list — the mockup's `.rowline`
 * visual (bottom hairline, no border on the last item) with only the
 * real data it has. */
export function TalentRow({ label, className }: TalentRowProps) {
  return (
    <div className={cx('border-b border-line-soft px-2 py-2 last:border-b-0', text.bodySecondary, className)}>
      {label}
    </div>
  )
}
