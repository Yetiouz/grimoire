import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

interface ToolsDockProps {
  /** Opens DiceRoller — the same handler JournalComposer's dice-trigger
   * button used before this pass moved it here (player-view-mockup.html
   * v10's `.tooldock`, not the composer). */
  onOpenDice: () => void
  diceDisabled?: boolean
  className?: string
}

const dockButtonClass = cx(
  'flex flex-1 aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-button border border-line-soft bg-panel text-ink-dim',
  'hover:border-line-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40',
)

function DockButton({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: IconName
  label: string
  onClick?: () => void
  disabled?: boolean
  title: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title} className={dockButtonClass}>
      <Icon name={icon} />
      <span className={text.label}>{label}</span>
    </button>
  )
}

/**
 * Three square icon buttons pinned to the bottom of the party rail
 * (player-view-mockup.html v10's `.tooldock`) — one row, icons
 * centered. Maps and Rules are structural stubs (per the reconciliation
 * work order: "structure ships" ahead of the features themselves,
 * disabled rather than wired to anything). Roll is real.
 *
 * `rounded-button` (11px), not the mockup's own one-off 12px — the
 * app's radius system is a closed two-value set (`--radius-card`/
 * `--radius-button` in index.css); these are buttons, so they get the
 * button radius rather than a third value invented to match the mockup
 * pixel-for-pixel. Labels stay at `text.label` (11px) rather than the
 * mockup's 8px for the same reason: typography is a closed set too.
 */
export function ToolsDock({ onOpenDice, diceDisabled, className }: ToolsDockProps) {
  return (
    <div className={cx('flex gap-2', className)}>
      <DockButton icon="map" label="Maps" title="Maps (coming soon)" disabled />
      <DockButton icon="rules" label="Rules" title="Rules (coming soon)" disabled />
      <DockButton icon="dice" label="Roll" title="Roll dice" onClick={onOpenDice} disabled={diceDisabled} />
    </div>
  )
}
