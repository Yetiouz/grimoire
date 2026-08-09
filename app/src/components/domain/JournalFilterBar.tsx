import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { FilterKind } from '../../lib/journalFilters'

interface FilterChip {
  kind: FilterKind
  label: string
}

const FILTER_CHIPS: FilterChip[] = [
  { kind: 'narration', label: 'Narration' },
  { kind: 'action', label: 'Action' },
  { kind: 'roll', label: 'Rolls' },
  { kind: 'note', label: 'Notes' },
  { kind: 'rules', label: 'Rules' },
]

interface JournalFilterBarProps {
  /** Which kinds are currently shown — every chip lit by default per
   * BOB_queue task 1 ("all lit by default, tap to mute"). */
  active: ReadonlySet<FilterKind>
  onToggle: (kind: FilterKind) => void
  /** Hides the Rules chip when the GM feature is off — nothing could
   * ever populate it, and it'd point at an "Ask Rules" mode that isn't
   * rendered anywhere either. */
  showRules?: boolean
  className?: string
}

/**
 * BOB_queue task 1: "chips for Narration, Action, Rolls, Notes, Rules,
 * all lit by default, tap to mute. Reuse the composer's kind-chip
 * pattern exactly — same pill, same sizing, same compact-pill
 * exception." Pulled directly from `JournalComposer.tsx`'s
 * `KIND_CHIPS` styling (`inline-flex items-center justify-center
 * rounded-full border px-3 py-1 uppercase` + `text.caption`) — same
 * already-approved exception to CLAUDE.md's 44px touch-target minimum
 * for this dense chip-row shape, not a new one.
 *
 * The one real difference from the composer's version: that's a
 * `role="radio"` single-select (pick one kind to log as this entry as).
 * This is a multi-toggle — every chip independently on/off, not
 * mutually exclusive — so each chip is `aria-pressed`, not part of a
 * radiogroup.
 */
export function JournalFilterBar({ active, onToggle, showRules = true, className }: JournalFilterBarProps) {
  const chips = showRules ? FILTER_CHIPS : FILTER_CHIPS.filter((chip) => chip.kind !== 'rules')

  return (
    <div className={cx('flex flex-wrap gap-2', className)} role="group" aria-label="Filter journal entries">
      {chips.map((chip) => {
        const isActive = active.has(chip.kind)
        return (
          <button
            key={chip.kind}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(chip.kind)}
            className={cx(
              'inline-flex items-center justify-center rounded-full border px-3 py-1 uppercase',
              text.caption,
              isActive
                ? 'border-purple bg-purple text-white'
                : 'border-line-soft bg-panel2 text-ink-dim hover:border-line-hover',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
