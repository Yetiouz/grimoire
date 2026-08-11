import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Icon } from '../ui/Icon'

interface JournalHeaderProps {
  campaignName: string
  sessionMeta: string
  /** The Start/End Session control (JournalScreen owns the command
   * calls) — rendered beside the campaign name, same "host owns the
   * action, header owns the layout" split PageHeader's `titleAction`
   * already uses. */
  sessionAction: ReactNode
  /** The owner-only "Invite" control (`CampaignInvite.tsx`, 2026-08-11)
   * — same "host owns the action, header owns the layout" split as
   * `sessionAction` above. Optional and rendered before it in the same
   * right-hand group: `JournalScreen` only passes this when the
   * signed-in user is the campaign owner (the RPC behind it enforces
   * that server-side too, but there's no reason to show a button a
   * player could never use). Omit entirely for a player's own view of
   * someone else's campaign. */
  inviteAction?: ReactNode
  onBack: () => void
  /** Wired into the hamburger menu's "Sign out" item (2026-08-11 —
   * "make the hamburger button usable"). The campaign-list screen has
   * had its own Sign out link since v1; this screen never did, which
   * meant leaving a campaign entirely required navigating back to
   * campaigns first. `JournalScreen` passes the same `signOut` call
   * `App.tsx`'s `AuthGate` already wires to `CampaignList`. */
  onSignOut: () => void
  /** Opens `CampaignSearch` (2026-08-10) — the pill used to be a plain,
   * unclickable div ("structure ships ahead of the feature," no search
   * index existed to point it at). Optional only for the same reason
   * `onOpenRules` is elsewhere: no build should hard-require a caller to
   * wire every affordance, though every real call site now does. Omit
   * to render the pill disabled, same look it always had. */
  onOpenSearch?: () => void
}

/**
 * Journal's two-bar header (player-view-mockup.html v10) — replaces the
 * single meta-strip-plus-h1 `PageHeader` band this screen used before
 * the visual-reconciliation pass. `PageHeader` itself is untouched:
 * Campaigns still uses it, and this screen's shape has diverged enough
 * (two distinct bars, not one) that forcing it through the same shared
 * component would mean bolting on props `PageHeader` was never built
 * for. Journal-specific, domain-tier, same reasoning as JournalFeed/
 * JournalComposer living outside `ui/`.
 *
 * Top bar: the brand mark (real `/logo.webp`, same asset SignIn uses)
 * doubles as the back-to-campaigns control — the mockup doesn't show a
 * breadcrumb at all, and dropping campaign navigation entirely would be
 * a real capability loss, not just a visual one, so the logo click is
 * the least-invasive way to keep it without adding anything the mockup
 * doesn't already have on that bar. Search opens `CampaignSearch`
 * (2026-08-10 — it and the hamburger menu shipped as structural stubs
 * only, per the work order's "may be non-functional stubs for now, but
 * the structure ships").
 *
 * The hamburger (2026-08-11, "make the hamburger button usable — on
 * mobile I can't get to campaigns") now opens a real menu: "Back to
 * Campaigns" (same `onBack` the logo tap already calls — the logo is a
 * 24px unlabeled image with no visible affordance that it's tappable,
 * which is exactly why it wasn't discoverable on a phone) and "Sign
 * out" (this screen never had one — `CampaignList` has had its own
 * since v1, but leaving a campaign used to require navigating back to
 * campaigns FIRST). Built as a small `role="menu"` popover anchored to
 * the button rather than reusing `Overlay`: `Overlay` is a full-screen
 * backdrop dialog for real content (Search, Rules) — two nav links
 * don't need to cover the screen, and a lightweight anchored popover is
 * the shape a "hamburger menu" actually implies. Closes on outside
 * click, Escape, or picking an item.
 *
 * Campaign bar: name stacked above session meta on the left, session
 * action (plus, as of 2026-08-11, the owner-only Invite control right
 * before it) pinned to the right (2026-08-10 rewrite — owner reported
 * the mobile header "messed up": the previous shape put name and meta+
 * action side by side in one `flex-wrap` row, which read fine on
 * desktop but on a narrow phone had nowhere to wrap the overflowing
 * meta+action group EXCEPT down to a new line starting at the left
 * edge — dropping the session buttons out from under the title instead
 * of keeping them at the right where SPEC always intended them. Naming
 * `min-w-0`+`truncate` on the left block and no `flex-wrap` on the row
 * itself means the buttons now stay pinned right at every width; a
 * very long campaign name truncates instead of pushing them off, same
 * `PlayerCard` truncation convention used elsewhere in this app.
 *
 * (2026-08-10, earlier the same day: this right-hand group briefly also
 * carried a GM budget meter, then an AI-voice on/off toggle — both
 * since moved out: the toggle to a per-message pill on `LogEntryRow`,
 * the budget meter down into `JournalComposer`. Neither is why the
 * layout broke — this row's original side-by-side shape was already
 * fragile on mobile before either was added — but both leaving is why
 * this rewrite has only the session action left to place, plus now
 * Invite alongside it.)
 */
export function JournalHeader({ campaignName, sessionMeta, sessionAction, inviteAction, onBack, onSignOut, onOpenSearch }: JournalHeaderProps) {
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
        <button type="button" onClick={onBack} aria-label="Back to campaigns" className="block">
          <img src="/logo.webp" alt="Grimoire" className="h-6 w-auto" />
        </button>
        <div className="flex items-center gap-2">
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
      {/* v11: campaign name + session meta stack on the left rail; the
        * session control group (plus Invite, when given) pins to the
        * right — no `flex-wrap` here, so the buttons never drop out
        * from under the title on a narrow phone (see the component doc
        * comment). */}
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <h1 className={cx(text.h3, 'truncate')}>{campaignName}</h1>
          <p className={cx(text.label, 'mt-0.5 truncate')}>{sessionMeta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {inviteAction}
          {sessionAction}
        </div>
      </div>
    </header>
  )
}
