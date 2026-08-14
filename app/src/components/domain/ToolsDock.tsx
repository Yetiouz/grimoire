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
  /** Slice 16. Optional: with the GM off, Rules stays the disabled stub
   * it has always been. */
  onOpenRules?: () => void
  /** Slice 8 (Maps overlay). Unlike `onOpenRules`, not gated behind
   * `gm_mode` — Region/Site maps are campaign data any member can view
   * or edit (no GM-only tier exists anywhere in this app's command
   * layer), so this is always provided by the caller once the overlay
   * exists. Optional only so the stub state (pre-slice-8 callers, and
   * this component's own tests) still renders correctly disabled. */
  onOpenMaps?: () => void
  /** BUILD_PLAN.md item 15 slice 3 (2026-08-14). Same "always provided
   * once the overlay exists" shape as `onOpenMaps`, not `onOpenRules`:
   * the GM reference viewer reads `system_packs`, whose RLS is open to
   * any campaign member (see `GmReference.tsx`'s own doc comment), so
   * there's no `gm_mode` gate for this button the way there is for
   * Rules. Optional only for the same pre-existence/test reason as the
   * other two. */
  onOpenGmReference?: () => void
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
 * centered. Maps stopped being a stub in slice 8 (Region + Site tabs,
 * Scene still a stub within the overlay itself); Rules is still a
 * structural stub when the GM is off. Roll is real.
 *
 * `rounded-button` (11px), not the mockup's own one-off 12px — the
 * app's radius system is a closed two-value set (`--radius-card`/
 * `--radius-button` in index.css); these are buttons, so they get the
 * button radius rather than a third value invented to match the mockup
 * pixel-for-pixel. Labels stay at `text.label` (11px) rather than the
 * mockup's 8px for the same reason: typography is a closed set too.
 */
export function ToolsDock({ onOpenDice, diceDisabled, onOpenRules, onOpenMaps, onOpenGmReference, className }: ToolsDockProps) {
  return (
    <div className={cx('flex gap-2', className)}>
      <DockButton
        icon="map"
        label="Maps"
        title={onOpenMaps ? 'Maps' : 'Maps (coming soon)'}
        onClick={onOpenMaps}
        disabled={!onOpenMaps}
      />
      {/* Rules stops being a stub when the GM is on: it opens the
        * out-of-character rules transcript. Questions are asked from the
        * composer; this is where you read them back. */}
      <DockButton
        icon="rules"
        label="Rules"
        title={onOpenRules ? 'Rules chat' : 'Rules (coming soon)'}
        onClick={onOpenRules}
        disabled={!onOpenRules}
      />
      {/* GM Reference (slice 3): the persona/house-rules source docs
        * themselves, not a gated stub — see `onOpenGmReference`'s own
        * doc comment for why this one isn't behind the `gm_mode` check
        * `Rules` is. */}
      <DockButton
        icon="gmRef"
        label="Reference"
        title={onOpenGmReference ? 'GM reference' : 'GM reference (coming soon)'}
        onClick={onOpenGmReference}
        disabled={!onOpenGmReference}
      />
      <DockButton icon="dice" label="Roll" title="Roll dice" onClick={onOpenDice} disabled={diceDisabled} />
    </div>
  )
}
