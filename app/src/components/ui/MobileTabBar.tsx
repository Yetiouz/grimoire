import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export type MobileView = 'party' | 'maps' | 'quests' | 'tools'

interface MobileTabBarProps {
  /** `null` means the journal (home) is showing — no tab is lit.
   * Tap-active-tab-returns-home is the CALLER's decision (see
   * `MobileJournalView`), not this component's: `onSelect` always just
   * reports which tab was tapped, so this stays a plain presentational
   * bar with no toggle logic of its own to keep in sync with the view
   * state it doesn't own. */
  active: MobileView | null
  onSelect: (view: MobileView) => void
  onOpenDice: () => void
  diceDisabled?: boolean
  className?: string
}

const TABS: Array<{ view: MobileView; icon: IconName; label: string }> = [
  { view: 'party', icon: 'party', label: 'Party' },
  { view: 'maps', icon: 'map', label: 'Maps' },
]
const TABS_AFTER_FAB: Array<{ view: MobileView; icon: IconName; label: string }> = [
  { view: 'quests', icon: 'quest', label: 'Quests' },
  { view: 'tools', icon: 'settings', label: 'Tools' },
]

function TabButton({ view, icon, label, active, onSelect }: { view: MobileView; icon: IconName; label: string; active: boolean; onSelect: (view: MobileView) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(view)}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex min-h-12 min-w-14 flex-col items-center justify-end gap-1.5 py-1',
        text.label,
        active ? 'text-purple' : 'text-ink-faint',
      )}
    >
      <Icon name={icon} state={active ? 'active' : 'default'} />
      <span>{label}</span>
    </button>
  )
}

/**
 * The mobile bottom tab bar (`mobile-view-mockup.html`'s `.tabbar`):
 * Party / Maps / a center dice FAB / Quests / Tools, below `xl:` only.
 * New this slice — nothing before it implemented "one view visible at a
 * time, tab-driven, tap-the-open-tab-returns-home"; every view it
 * switches between is an existing component (`PlayerCard`, quest
 * cards, `ToolsDock`-style tiles) reused as-is.
 *
 * A plain flex row at the bottom of `MobileJournalView`'s column, not
 * `position: fixed` — the mockup's own `.tabbar` is just the last flex
 * child of its phone frame's column layout, and `MobileJournalView`'s
 * container is already the full-height flex column below `xl:`
 * (`JournalScreen`'s mobile branch), so this only needs to be its last
 * `shrink-0` child to sit at the bottom the same way.
 */
export function MobileTabBar({ active, onSelect, onOpenDice, diceDisabled, className }: MobileTabBarProps) {
  return (
    <div
      className={cx(
        'tabbar-safe-bottom flex shrink-0 items-end justify-around border-t border-line bg-panel/95 px-2 pt-2.5',
        className,
      )}
    >
      {TABS.map((tab) => (
        <TabButton key={tab.view} {...tab} active={active === tab.view} onSelect={onSelect} />
      ))}
      <button
        type="button"
        onClick={onOpenDice}
        disabled={diceDisabled}
        aria-label="Roll dice"
        title={diceDisabled ? 'Start a session to roll' : 'Roll dice'}
        className="-mt-[22px] flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-purple/30 bg-purple text-white shadow-[0_8px_24px_-6px_rgba(155,92,255,0.6)] disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon name="dice" className="text-white" label="Roll dice" />
      </button>
      {TABS_AFTER_FAB.map((tab) => (
        <TabButton key={tab.view} {...tab} active={active === tab.view} onSelect={onSelect} />
      ))}
    </div>
  )
}
