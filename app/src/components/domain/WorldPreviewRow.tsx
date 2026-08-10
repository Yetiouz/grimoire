import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { StatusDot } from '../ui/StatusDot'
import type { StatusIndicator } from '../../lib/statusTone'

interface WorldPreviewRowProps {
  title: string
  indicator: StatusIndicator | null
  /** One line of context — `npc.role`, `faction.type`, `quest.goal`, or a
   * category+quantity string for treasure. Truncated to one line
   * (`truncate`, not a multi-line clamp) rather than wrapped: the point of
   * a preview is a fixed, scannable row height across a list of up to 17
   * items, not "however many lines this one entry's text happens to
   * need." Full text lives in the detail overlay this row opens. */
  preview: string | null
  onClick: () => void
}

/**
 * The compact, always-visible list row for every Quest Log tab
 * (2026-08-10, owner's call: "they can all be previews... then when you
 * click on it, it will pop up a screen with all the info"). One shared
 * component across Quests/NPCs/Factions/Treasure rather than four
 * bespoke preview shapes — the four tabs' full detail cards
 * (`QuestCard`/`NpcCard`/`FactionCard`/`TreasureRow`) already diverge in
 * field layout because their real data diverges; the PREVIEW doesn't
 * need to, since every one reduces to the same three things: a title, a
 * status, and one line of context. `WorldDetailOverlay` is the click
 * target this opens.
 *
 * A real `<button>`, not a clickable `<div>` — free keyboard/focus
 * support and the 44px touch-target minimum via `min-h-11`, matching
 * every other interactive row in this app (`DockButton`, `PlayerCard`).
 */
export function WorldPreviewRow({ title, indicator, preview, onClick }: WorldPreviewRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full flex-col gap-1 rounded-card border border-line-soft bg-panel2 px-3 py-2.5 text-left hover:border-line-hover"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={cx(text.body, 'truncate font-semibold')}>{title}</span>
        {indicator && <StatusDot {...indicator} />}
      </div>
      {preview && <span className={cx(text.caption, 'truncate text-ink-dim')}>{preview}</span>}
    </button>
  )
}
