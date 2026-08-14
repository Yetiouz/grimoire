import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'

interface JournalHeaderProps {
  campaignName: string
  sessionMeta: string
  /** The Start/End Session + pause control (JournalScreen owns the
   * command calls) — rendered in the top-right group, between search
   * and the hamburger. */
  sessionAction: ReactNode
  /** Opens the owner-only invite modal (`CampaignInviteModal` —
   * `JournalScreen` owns the open state). Lives in the hamburger menu,
   * not the button row — see the component doc comment. Only rendered
   * when given: `JournalScreen` passes this exclusively when the
   * signed-in user is the campaign owner (the RPC behind it enforces
   * that server-side too, but there's no reason to show a menu item a
   * player could never use). */
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
 * Journal's single-row header — third pass in the 2026-08-14 rework
 * (mockup review -> "Option B" two-row split -> this single-row
 * collapse), driven by two more owner notes on the live Option B build:
 * "AI GM · Session 15" was already showing a second time on the
 * journal column itself (`JournalDesktopLayout`'s `ColumnCard`), and
 * the pause/Stop Session buttons read better sitting with the other
 * chrome controls (search, hamburger) than parked in their own row
 * below.
 *
 * One row now, not two. The back-to-campaigns button is a lockup: the
 * brand mark beside a two-line text block (campaign name, then session
 * meta right under it — the pre-Option-B stacked shape, just moved
 * in next to a bigger logo instead of alone under a floating one). The
 * mark is sized to visually span both lines and then some (`h-11` as
 * of a same-day size-up from this pass's original `h-9` — up from the
 * single-line `h-6` original before that) rather than the earlier
 * hero-row's single-line height — a real, deliberate size change this
 * time, not the "same size everywhere, no responsive drift" guarantee
 * the previous round's doc comment described (that guarantee still
 * holds: nothing here carries a breakpoint-specific size override, so
 * mark and text stay in this same proportion at every viewport
 * width). `h-11` also isn't an arbitrary number here — it's the same
 * 44px this app already uses everywhere else for a touch target
 * (search, hamburger, SessionAction's own buttons), so the mark now
 * reads as sized to match its neighbors, not just "big."
 * min-w-0 down the chain (button, text block, both lines) so a very
 * long campaign name truncates instead of pushing search/session
 * controls/hamburger off-screen — same `PlayerCard` truncation
 * convention used elsewhere. `alt=""` on the mark: the button's own
 * `aria-label` is already the accessible name for the whole control.
 *
 * Right-hand group, left to right: search (hidden below `sm:`, same as
 * always), the session action (pause + Start/End Session), then the
 * hamburger — session controls sit between search and the menu button
 * on every width; search just drops out below `sm:`, which
 * automatically leaves the session controls as the hamburger's
 * immediate left neighbor on a phone without a separate mobile-only
 * ordering rule.
 *
 * The hamburger (2026-08-11, "make the hamburger button usable") menu
 * still carries three items: "Back to Campaigns" (same `onBack` the
 * lockup's own tap already calls), the owner-only "Invite" item (only
 * rendered when `onOpenInvite` is given — moved here in the Option B
 * pass and unchanged since), and "Sign out". Small `role="menu"`
 * popover anchored to the button, not `Overlay` — a few nav/action
 * links don't need a full-screen backdrop dialog. Closes on outside
 * click, Escape, or picking an item.
 *
 * `JournalDesktopLayout`'s own journal column now labels itself plainly
 * ("Journal", a static string — see that file) instead of repeating
 * this same session-meta text, since this header shows it now. That
 * dedup is the other half of why this round happened at all.
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
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to campaigns"
          className="-ml-2 flex min-h-11 min-w-0 items-center gap-2.5 rounded-button py-1.5 pl-2 pr-3 hover:bg-panel2"
        >
          <img src="/logo.webp" alt="" className="h-11 w-auto shrink-0" />
          <div className="min-w-0 text-left">
            <h1 className={cx(text.h3, 'truncate')}>{campaignName}</h1>
            <p className={cx(text.label, 'mt-0.5 truncate')}>{sessionMeta}</p>
          </div>
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
          {sessionAction}
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
    </header>
  )
}
