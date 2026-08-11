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
 * the structure ships"; the menu still has no real target, no nav menu
 * exists yet, so it alone stays disabled).
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
export function JournalHeader({ campaignName, sessionMeta, sessionAction, inviteAction, onBack, onOpenSearch }: JournalHeaderProps) {
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
          <button
            type="button"
            disabled
            aria-label="Menu (coming soon)"
            title="Coming soon"
            className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-panel text-ink-dim opacity-50"
          >
            <Icon name="menu" />
          </button>
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
