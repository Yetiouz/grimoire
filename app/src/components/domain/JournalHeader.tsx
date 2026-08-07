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
  onBack: () => void
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
 * doesn't already have on that bar. Search and the hamburger menu are
 * structural stubs only, per the work order ("may be non-functional
 * stubs for now, but the structure ships") — neither has a real target
 * yet (no search index, no nav menu), so both render disabled.
 *
 * Campaign bar: name + the session action grouped on the left (the
 * mockup's campbar has no action control at all — its session-meta line
 * is read-only text — but Journal needs a real Start/End Session
 * trigger somewhere, and grouping it with the name it belongs to reads
 * better than inventing a third bar for one button); session meta
 * right-aligned, matching the mockup exactly.
 *
 * Mobile layout slice: the top bar (logo/search/menu) hides below `xl:`
 * — `mobile-view-mockup.html`'s own top bar is "campaign name + meta
 * left, pause + stop right — one bar instead of two," and search/menu
 * are non-functional stubs regardless of viewport, so hiding them below
 * `xl:` loses no real capability. Losing the logo does lose the only
 * back-to-campaigns control, though, so the campaign name itself
 * becomes that control below `xl:` — a real `back` chevron plus the
 * name, wrapped in one button; `pointer-events-none` at `xl:` and up
 * makes it visually inert there (the logo is still the desktop control,
 * unchanged) while leaving it keyboard-reachable regardless of size.
 */
export function JournalHeader({ campaignName, sessionMeta, sessionAction, onBack }: JournalHeaderProps) {
  return (
    <header className="border-b border-line">
      <div className="hidden items-center justify-between gap-4 border-b border-line-soft px-4 py-2 xl:flex">
        <button type="button" onClick={onBack} aria-label="Back to campaigns" className="block">
          <img src="/logo.webp" alt="Grimoire" className="h-6 w-auto" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className={cx(
              'hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-ink-faint sm:flex',
              text.caption,
            )}
          >
            {/* Icon.tsx's 24px grid is fixed, not overridable per-call-
             * site (its own documented rule) — the pill grows to fit it
             * rather than the icon shrinking to fit a compact chip. */}
            <Icon name="search" />
            <span>Search the campaign…</span>
          </div>
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
      {/* v11: campaign name holds the left rail; the session control
        * group holds the right — meta text sits immediately LEFT of the
        * colored session buttons (SessionAction), which are the
        * far-right element per the owner's design note. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to campaigns"
          className="flex items-center gap-1 xl:pointer-events-none"
        >
          <Icon name="back" className="xl:hidden" />
          <h1 className={text.h3}>{campaignName}</h1>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className={text.label}>{sessionMeta}</span>
          {sessionAction}
        </div>
      </div>
    </header>
  )
}
