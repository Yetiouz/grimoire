import {
  Backpack,
  BookMarked,
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
  Send,
  Settings,
  Shield,
  Sparkle,
  Sparkles,
  StickyNote,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { CSSProperties } from 'react'
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
 * `search` and `menu` started as non-functional stubs (no search index
 * or nav menu existed yet); both are wired to real destinations now
 * (`search` since 2026-08-10's `CampaignSearch`, `menu` since
 * 2026-08-11's header dropdown — see `JournalHeader.tsx`).
 * `map`/`rules` label the two other disabled dock stub buttons
 * alongside the real `dice` one.
 *
 * `back`/`quest`/`world` added for the mobile layout slice
 * (`mobile-view-mockup.html`): `back` labels the collapsed mobile
 * header's tap-to-return-to-campaigns control (the desktop header uses
 * the logo for this; the mobile header's single bar has no logo, so it
 * needs a real affordance instead of an implicit tap target); `quest`
 * labels the bottom tab bar's Quests tab (no existing icon fit — not
 * reusing `journal`, which already means the scene log specifically);
 * `world` labels one of the four Tools-grid stub tiles (Rules/Search/
 * Campaign/World).
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
 *
 * `send` added for the journal composer's submit button (2026-08-11,
 * "change log send buttons to a send icon") — the button used to read
 * "Send"/"Log" as plain text; replaced with this glyph for both modes
 * (see `JournalComposer.tsx`) since a paper-plane icon already reads as
 * "submit this" regardless of which of the two words it used to be.
 *
 * `invite` added for the mobile Tools grid's owner-only "Invite" tile
 * (2026-08-11, "fix the Campaign tools tile" — that tile used to be a
 * dead `settings`-icon stub pointing nowhere; a genuinely new action,
 * not a relabeling of an existing one, so it earns its own glyph rather
 * than reusing `settings` or `party` — `party` already means "the
 * roster," and this means "bring someone new into it," which `settings`
 * doesn't capture either). Distinct from `party`'s `Users` for exactly
 * that reason: one person joining the roster, not the roster itself.
 *
 * `gmRef` added for the GM Reference viewer's ToolsDock/Tools-tile
 * entry point (BUILD_PLAN.md item 15 slice 3) — deliberately a
 * different glyph from `rules`' `BookOpen`, even though both live under
 * "things you look up mid-session": `rules` opens the out-of-character
 * Q&A transcript (a conversation), this opens the persona/house-rules
 * source documents directly (a reference shelf). `BookMarked` reads as
 * "the book you keep a place in," distinct enough from the open-book
 * `rules` glyph that the two tiles don't look like duplicates of each
 * other.
 */
// `thinking` added for the journal composer's send button (2026-08-16,
// slice A follow-up: "we need a thinking icon like claude has") — while
// the AI GM is generating, the send button swaps its arrow for this
// pulsing spark instead of the old expanding dots-and-text row, so the
// composer's height never changes while waiting. Maps to the same
// lucide glyph as `luck` (Sparkles) on purpose — the semantic names are
// the closed set here, not the glyphs, and "a spark of thought" is
// exactly the association Claude's own thinking indicator trades on.
const icons = {
  hp: Heart,
  thinking: Sparkles,
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
  send: Send,
  invite: UserPlus,
  gmRef: BookMarked,
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
  /** Escape hatch for a runtime, per-instance color that beats
   * `stateColorClass` — added 2026-08-11 for the journal composer's
   * send button, whose background is one of several chip colors picked
   * at runtime (`selected.hex`), so the icon needs the same guaranteed
   * contrast color (`#0a0a0c`) that button already sets on itself via
   * inline style, same "arbitrary runtime color Tailwind can't
   * generate a class for" reasoning `senderColor`/`selected.hex`
   * already use elsewhere. Forwarded straight to the underlying
   * lucide `<LucideIcon>`, after `stateColorClass`'s `className` so it
   * wins regardless of stylesheet order (inline style always beats a
   * class). Omit for every ordinary icon — this only exists for the
   * one caller that needs to fight the default. */
  style?: CSSProperties
  /** Second sanctioned size (2026-08-16, owner: "speaker and notes
   * icons can be smaller, like in the Claude desktop") — 16px for
   * dense, repeated inline utility controls (the feed's per-entry
   * quick actions, the composer's thinking spark), where 24px reads as
   * bulk rather than affordance. Still a closed set of exactly two
   * sizes, not a free `size` number prop — same governance reasoning
   * as the icon names themselves. */
  small?: boolean
}

/** The only sanctioned way to render an icon in Grimoire — see the style
 * guide's Iconography section for the full rules. Every icon renders at
 * one of exactly two sizes (24px default, 16px via `small` — see that
 * prop's doc comment) and the same stroke weight (lucide's defaults,
 * hardcoded here rather than exposed as free props, so no call site can
 * quietly drift off them). */
export function Icon({ name, state = 'default', className, label, style, small = false }: IconProps) {
  const LucideIcon = icons[name]
  return (
    <LucideIcon
      size={small ? 16 : 24}
      strokeWidth={2}
      className={cx(stateColorClass[state], className)}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
