import {
  Backpack,
  BookOpen,
  ChevronRight,
  Dice5,
  Flame,
  Heart,
  Map,
  Menu,
  MessageSquare,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkle,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * `name` is a closed set — the initial working set the journal and nav
 * actually need (SPEC's stat strip: HP/AC/Gear/Luck/Torch, plus the
 * scene log/chat/dice/roster/settings/dismiss/disclosure basics), not
 * lucide's full icon library. Same governance as the typography and
 * spacing closed sets: add to this map deliberately, don't reach past
 * it for a one-off import elsewhere.
 *
 * `bless` added for BUILD_PLAN.md slice 3's PlayerCard (per the vision
 * mockup's `.ic.bless` — a distinct icon from `luck`'s Sparkles, purple
 * rather than cyan, shown only when a character has a real active
 * blessing).
 *
 * `search`/`menu`/`map`/`rules` added for the visual-reconciliation
 * pass's two-bar header and tools dock (player-view-mockup.html v10) —
 * `search` and `menu` are non-functional stubs for now (no search index
 * or nav menu exists yet), `map`/`rules` label the two other disabled
 * dock stub buttons alongside the real `dice` one.
 */
const icons = {
  hp: Heart,
  ac: Shield,
  gear: Backpack,
  luck: Sparkles,
  bless: Sparkle,
  torch: Flame,
  journal: ScrollText,
  chat: MessageSquare,
  dice: Dice5,
  party: Users,
  settings: Settings,
  close: X,
  disclosure: ChevronRight,
  search: Search,
  menu: Menu,
  map: Map,
  rules: BookOpen,
} as const

export type IconName = keyof typeof icons

export type IconState = 'default' | 'active' | 'danger'

// Colors come from the existing palette only (SPEC's "colored only via
// existing tones" rule) — ink-dim for the resting state, the app's one
// accent (purple) for active, and the same red DangerBanner/dice
// fumbles already use for danger. Defined once, here — call sites pick
// a state, they don't pick a color.
const stateColorClass: Record<IconState, string> = {
  default: 'text-ink-dim',
  active: 'text-purple',
  danger: 'text-red',
}

interface IconProps {
  name: IconName
  state?: IconState
  className?: string
  /** Accessible label. Omit only when the icon sits next to visible text
   * that already says the same thing — it renders aria-hidden then.
   * Given, it renders as an accessible image (role="img"). */
  label?: string
}

/** The only sanctioned way to render an icon in Grimoire — see the style
 * guide's Iconography section for the full rules. Every icon renders at
 * the same 24px grid and the same stroke weight (lucide's own defaults,
 * hardcoded here rather than exposed as props, so no call site can
 * quietly drift off them). */
export function Icon({ name, state = 'default', className, label }: IconProps) {
  const LucideIcon = icons[name]
  return (
    <LucideIcon
      size={24}
      strokeWidth={2}
      className={cx(stateColorClass[state], className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
