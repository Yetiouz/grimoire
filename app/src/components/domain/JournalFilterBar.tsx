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
  /** Header-sized chips (owner request: "make the filters smaller and
   * put it in the header") — tighter padding, smaller type, no wrap,
   * for living inside ColumnHeader's fixed 38px row on desktop. Mobile
   * keeps the default full-size chips: same component, same behaviour,
   * touch-friendly sizing where touch is the input. */
  compact?: boolean
  className?: string
}

/**
 * BOB_queue task 1's filter chips: Narration, Action, Rolls, Notes,
 * Rules — all lit by default, tap to mute. Multi-toggle, so each chip
 * is `aria-pressed` rather than part of a radiogroup (the composer's
 * kind chips are the single-select `role="radio"` cousins).
 *
 * The lit style is deliberately NOT the composer's solid-purple pill
 * anymore (owner: "maybe change the light style", after pointing out
 * the two rows read as duplicates). A lit filter is a soft purple
 * tint — purple text on a translucent purple wash — and a muted one is
 * a dim ghost. View-toggles now look like view-toggles; the solid
 * purple chip means "what you're logging" and only ever appears in the
 * composer.
 */
export function JournalFilterBar({ active, onToggle, showRules = true, compact = false, className }: JournalFilterBarProps) {
  const chips = showRules ? FILTER_CHIPS : FILTER_CHIPS.filter((chip) => chip.kind !== 'rules')

  return (
    <div
      // Full-size (mobile) spreads the chips edge-to-edge with
      // `justify-between` — owner: the row should sit "the same space on
      // one side as it is on the other", not left-packed with a ragged
      // gap at the right. Compact (desktop header) keeps natural widths.
      className={cx('flex items-center', compact ? 'shrink-0 gap-1' : 'w-full justify-between gap-1', className)}
      role="group"
      aria-label="Filter journal entries"
    >
      {chips.map((chip) => {
        const isActive = active.has(chip.kind)
        return (
          <button
            key={chip.kind}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(chip.kind)}
            className={cx(
              'inline-flex items-center justify-center rounded-full border uppercase',
              compact ? 'px-2 py-0.5 text-[10px] leading-none tracking-wide' : cx(text.caption, 'px-3 py-1'),
              isActive
                ? 'border-purple/40 bg-purple/15 text-purple'
                : 'border-line-soft bg-transparent text-ink-faint hover:border-line-hover hover:text-ink-dim',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
