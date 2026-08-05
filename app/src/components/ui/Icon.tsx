import { Backpack, ChevronRight, Dice5, Flame, Heart, MessageSquare, ScrollText, Settings, Shield, Sparkles, Users, X } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * `name` is a closed set — the initial working set the journal and nav
 * actually need (SPEC's stat strip: HP/AC/Gear/Luck/Torch, plus the
 * scene log/chat/dice/roster/settings/dismiss/disclosure basics), not
 * lucide's full icon library. Same governance as the typography and
 * spacing closed sets: add to this map deliberately, don't reach past
 * it for a one-off import elsewhere.
 */
const icons = {
  hp: Heart,
  ac: Shield,
  gear: Backpack,
  luck: Sparkles,
  torch: Flame,
  journal: ScrollText,
  chat: MessageSquare,
  dice: Dice5,
  party: Users,
  settings: Settings,
  close: X,
  disclosure: ChevronRight,
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
