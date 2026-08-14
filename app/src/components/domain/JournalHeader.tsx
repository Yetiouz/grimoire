import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'

interface JournalHeaderProps {
  campaignName: string
  sessionMeta: string
  /** The Start/End Session + pause control (JournalScreen owns the
   * command calls) — rendered in the utility row's right-hand group. */
  sessionAction: ReactNode
  /** Opens the owner-only invite modal (`CampaignInviteModal` —
   * `JournalScreen` owns the open state). As of the 2026-08-14 header
   * rework ("Option B"), Invite is no longer a button in the header at
   * all — it's a hamburger-menu item, same tier as "Back to Campaigns"/
   * "Sign out" below. Only rendered when given: `JournalScreen` passes
   * this exclusively when the signed-in user is the campaign owner (the
   * RPC behind it enforces that server-side too, but there's no reason
   * to show a menu item a player could never use). */
  onOpenInvite?: () => void
  onBack: () => void
  /** Wired into the hamburger menu's "Sign out" item (2026-08-11 —
   * "make the hamburger button usable"). `JournalScreen` passes the same
   * `signOut` call `App.tsx`'s `AuthGate` already wires to
   * `CampaignList`. */
  onSignOut: () => void
  /** Opens `CampaignSearch` (2026-08-10). Optional only for the same
   * reason `onOpenRules` is elsewhere: no build should hard-require a
   * caller to wire every affordance, though every real call site now
   * does. Omit to render the pill disabled, same look it always had. */
  onOpenSearch?: () => void
}

/**
 * Journal's two-bar header — "Option B" from the 2026-08-14 header
 * mockup round ("title-led hero row + controls get their own row"),
 * replacing the v10/v11 shape this screen shipped with since the
 * visual-reconciliation pass. Two complaints drove the rework (owner
 * review of a live mockup, not a bug report): the old top bar's bare
 * `/logo.webp` mark read as an orphaned icon with nothing pairing it to
 * "this is Grimoire, tap to go back" — and the old campaign-bar's
 * name+meta stack getting squeezed against Invite+pause+Stop Session on
 * a narrow phone was the same class of crowding problem `PlayerCard`'s
 * stat row and the desktop party column already hit twice (see
 * `JournalDesktopLayout`'s own 16rem->18rem->20rem doc comments) — just
 * one level up, in the chrome instead of the content.
 *
 * Top bar is now the hero row: the brand mark sits directly beside the
 * campaign name — both inside one button, both the back-to-campaigns
 * tap target — instead of floating alone with nothing to pair it to.
 * Solves "logo looks out of place" by giving it an obvious textual
 * partner rather than relabeling or shrinking it. Search + hamburger
 * keep their existing top-right position. The mark and the title
 * deliberately carry no responsive size classes anywhere in this file,
 * so they stay in constant visual proportion to each other at every
 * viewport width by construction — the mockup round's "the G isn't the
 * same size relative to the title on mobile vs desktop" note was an
 * artifact of the static mockup itself (which hardcoded two different
 * pixel sizes per illustration frame for comparison); this component
 * only ever renders once, not twice per breakpoint, so that drift can't
 * happen here.
 *
 * Utility row: session meta on the left (no longer stacked directly
 * under the title — see "what this costs" below), pause + Start/End
 * Session pinned right. Invite used to live in this row too; it's gone
 * from here entirely as of this rework, moved into the hamburger menu.
 * That's a real cost — getting to the invite code is one more tap for
 * the owner than it used to be — but Invite was also the one control in
 * this row that most viewers (every non-owner) could never use anyway,
 * making it the one that made sense to demote rather than the session
 * controls everyone reaches for.
 *
 * The hamburger (2026-08-11, "make the hamburger button usable") menu
 * now has three items instead of two: "Back to Campaigns" (same
 * `onBack` the hero row's own tap already calls), the owner-only
 * "Invite" item (only rendered when `onOpenInvite` is given), and "Sign
 * out". Still a small `role="menu"` popover anchored to the button
 * rather than `Overlay` — a few nav/action links don't need a
 * full-screen backdrop dialog. Closes on outside click, Escape, or
 * picking an item.
 *
 * What this rework costs, named rather than left implicit: the campaign
 * name and session meta are no longer visually paired as a title+
 * subtitle stack — they're on separate rows now — so "AI GM · Session
 * 15" reads more like a toolbar label than a subtitle. And Stop
 * Session collapsing to an icon-only red square below `sm:` (see its
 * own doc comment in `SessionAction.tsx`) means a player on the
 * narrowest phones loses the in-progress "Stopping…" text during that
 * async call — same tradeoff Pause's icon-only button already accepted
 * everywhere; only `disabled:opacity-40` signals the pending state
 * there too.
 */
export function JournalHeader({ campaignName, sessionMeta, sessionAction, onOpenInvite, onBack, onSignOut, onOpenSearch }: JournalHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Outside-click + Escape to close — same two dismissal paths
  // `Overlay` gives every full-screen dialog in this app, scaled down
  // for a small anchored popover (no backdrop element to click, since a
  // backdrop would defeat the point of a lightweight menu, so this
  // listens on the document instead).
  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="border-b border-line">
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-2">
        {/* Hero row (2026-08-14 rework): brand mark + campaign name
          * share one tap target instead of the mark floating alone.
          * min-w-0 on both the button and the h1 so a very long
          * campaign name truncates instead of pushing search/hamburger
          * off-screen — same PlayerCard truncation convention used
          * elsewhere in this app. alt="" on the mark: the button's own
          * aria-label is already the accessible name for the whole
          * control, so a second "Grimoire" announcement on the image
          * would just be noise for screen readers. */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to campaigns"
          className="-ml-2 flex min-h-11 min-w-0 items-center gap-2 rounded-button py-1 pl-2 pr-3 hover:bg-panel2"
        >
          <img src="/logo.webp" alt="" className="h-6 w-auto shrink-0" />
          <h1 className={cx(text.h3, 'min-w-0 truncate')}>{campaignName}</h1>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            disabled={!onOpenSearch}
            aria-label="Search the campaign"
            className={cx(
              'hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-ink-faint sm:flex',
              'disabled:pointer-events-none disabled:opacity-50',
              onOpenSearch && 'hover:border-line-hover hover:text-ink',
              text.caption,
            )}
          >
            {/* Icon.tsx's 24px grid is fixed, not overridable per-call-
             * site (its own documented rule) — the pill grows to fit it
             * rather than the icon shrinking to fit a compact chip. */}
            <Icon name="search" />
            <span>Search the campaign…</span>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel text-ink-dim hover:border-line-hover hover:text-ink',
                menuOpen && 'border-line-hover text-ink',
              )}
            >
              <Icon name="menu" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-card border border-line bg-panel shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onBack()
                  }}
                  className={cx('flex min-h-11 w-full items-center px-4 text-left hover:bg-panel2 hover:text-ink', text.label)}
                >
                  Back to Campaigns
                </button>
                {/* Owner-only, per onOpenInvite's own doc comment — the
                  * RPC behind it also enforces owner-only server-side,
                  * this just keeps the item off a player's menu. */}
                {onOpenInvite && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenInvite()
                    }}
                    className={cx(
                      'flex min-h-11 w-full items-center border-t border-line-soft px-4 text-left hover:bg-panel2 hover:text-ink',
                      text.label,
                    )}
                  >
                    Invite
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onSignOut()
                  }}
                  className={cx(
                    'flex min-h-11 w-full items-center border-t border-line-soft px-4 text-left hover:bg-panel2 hover:text-ink',
                    text.label,
                  )}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Utility row (2026-08-14 rework): session meta left, pause +
        * Start/End Session right — no title to pair with here anymore
        * (see the component doc comment's "what this costs"). */}
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <p className={cx(text.label, 'min-w-0 truncate')}>{sessionMeta}</p>
        <div className="flex shrink-0 items-center gap-2">{sessionAction}</div>
      </div>
    </header>
  )
}
