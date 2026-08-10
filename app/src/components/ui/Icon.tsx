import {
  Backpack,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Dice5,
  Flag,
  Flame,
  Globe,
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
  StickyNote,
  Users,
  Volume2,
  VolumeX,
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
 *
 * `back`/`quest`/`world` added for the mobile layout slice
 * (`mobile-view-mockup.html`): `back` labels the collapsed mobile
 * header's tap-to-return-to-campaigns control (the desktop header uses
 * the logo for this; the mobile header's single bar has no logo, so it
 * needs a real affordance instead of an implicit tap target); `quest`
 * labels the bottom tab bar's Quests tab (no existing icon fit — not
 * reusing `journal`, which already means the scene log specifically);
 * `world` labels one of the four Tools-grid stub tiles (Rules/Search/
 * Campaign/World), alongside the already-existing `rules`/`search` and
 * `settings` (reused for the Campaign tile — a settings glyph already
 * fits "campaign management" without adding a fifth one-off icon for a
 * destination that, like the other three, doesn't exist yet).
 *
 * `saveNote` added for the "save as note" quick action on journal
 * entries (2026-08-09): a distinct glyph from `journal` (which already
 * means the scene log as a whole) so a per-entry "copy this into a
 * note" control reads as its own thing rather than a second way to
 * open the log.
 *
 * `speak` added for the read-aloud quick action on narration entries
 * (2026-08-09) — one glyph doing double duty as both the "read this
 * aloud" and "stop reading" control (LogEntryRow toggles `state` to
 * `active` while speech is in progress rather than swapping to a
 * second icon, so the button never jumps between two different shapes
 * for what is, to the player, one control with two states).
 *
 * `voiceOff` added for the journal header's AI-voice toggle
 * (2026-08-10, AiVoiceToggle.tsx) — a genuinely different glyph from
 * `speak`/Volume2 rather than reusing it with a strikethrough via CSS,
 * so the muted state is legible at a glance the way LogEntryRow's own
 * two-states-one-glyph choice above is for a different reason (there,
 * the glyph stays the same on purpose; here, the state IS the thing
 * being communicated, so it shouldn't).
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
  back: ChevronLeft,
  quest: Flag,
  world: Globe,
  saveNote: StickyNote,
  speak: Volume2,
  voiceOff: VolumeX,
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
