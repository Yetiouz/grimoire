import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface SessionActionProps {
  open: boolean
  /** True when the currently-open session is paused (`sessions.paused_at`
   * set) — meaningless when `open` is false, since there's nothing to
   * pause. */
  paused: boolean
  starting: boolean
  ending: boolean
  pausing: boolean
  resuming: boolean
  onStart: () => void
  onEnd: () => void
  onPause: () => void
  onResume: () => void
}

/** Shared 16x16 viewBox for the three filled transport glyphs below —
 * deliberately NOT `Icon.tsx`'s 24px stroke-only grid (that spec is for
 * outline icons; pause/play/stop read as solid glyphs everywhere, same
 * as any media-transport control). Drawn on one shared coordinate
 * system so their filled area — and so their visual weight — actually
 * matches instead of relying on a font's own glyph metrics: this
 * replaces three plain Unicode characters (⏸ ▶ ■, 2026-08-14 fix,
 * "fix the pause icon so it matches the style of the stop button") that
 * rendered at inconsistent sizes against each other depending on the
 * browser's font, most visibly pause's ⏸ reading noticeably smaller
 * and lighter than stop's ■ once both sat side by side as matching
 * icon-only squares. */
function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="3.2" height="12" rx="1" />
      <rect x="9.8" y="2" width="3.2" height="12" rx="1" />
    </svg>
  )
}

function ResumeGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.3v11.4a.8.8 0 0 0 1.22.68l9.1-5.7a.8.8 0 0 0 0-1.36l-9.1-5.7A.8.8 0 0 0 4 2.3z" />
    </svg>
  )
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  )
}

/**
 * v11 (SPEC decision log): the session button IS the session indicator —
 * no separate status dot. "Start Session" renders green-tinted when no
 * session is open; "Stop Session" renders red-tinted while one is.
 *
 * The pause square (2026-08-10) is real now, not the structural stub it
 * shipped as — `end_session`'s own migration had logged "no pause,
 * confirmed directly" as a deliberate decision, re-confirmed and
 * reversed directly with the owner rather than silently overridden (see
 * `lib/campaigns.ts`'s `pauseSession` doc comment). Disabled whenever
 * there's no open session to pause (nothing to act on); while open, it
 * toggles between pause (yellow) and resume (green) depending on
 * `paused` — same tint pattern as Start/Stop (`color/12` bg, `color/45`
 * border, matching `DangerBanner`'s tone treatment) rather than a third
 * new color.
 *
 * Stop Session collapses to an icon-only red square below `sm:`
 * (2026-08-14, header rework round 2 — "on mobile change stop session
 * to an icon button also," the same crowding fix already applied to
 * Invite/the header's button row) — same treatment pause already had
 * everywhere, just extended to Stop. Text label returns at `sm:` and up
 * since there's no crowding problem to solve on a wider viewport.
 * Deliberately NOT applied to Start Session: it's a different, rarer
 * state (this button only shows Start when nothing is running yet, not
 * the common in-play case) and wasn't part of what was flagged, so it
 * keeps its full text at every width rather than being changed on
 * spec. The `ending`-state "Stopping…" text is lost on the icon-only
 * mobile button during that async call — same tradeoff the pause
 * button already made everywhere; only `disabled:opacity-40` signals
 * the pending state there too, and now here.
 *
 * Pause/resume/Stop all draw from the shared `*Glyph` components above
 * (2026-08-14, same-day follow-up) instead of a bare Unicode character
 * each — see that comment for why.
 *
 * JournalScreen still owns every command call; this component only
 * renders state and forwards clicks.
 */
export function SessionAction({ open, paused, starting, ending, pausing, resuming, onStart, onEnd, onPause, onResume }: SessionActionProps) {
  const base = cx(
    'inline-flex h-11 items-center justify-center rounded-button border px-4 font-mono uppercase',
    text.caption,
    'transition-[background-color,border-color,opacity] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  )

  return (
    <div className="flex items-center gap-2">
      {open && paused ? (
        <button
          type="button"
          onClick={onResume}
          disabled={resuming}
          aria-label="Resume session"
          title="Resume this session"
          className={cx(base, 'w-11 border-green/45 bg-green/10 px-0 text-green')}
        >
          <ResumeGlyph />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPause}
          disabled={!open || pausing}
          aria-label="Pause session"
          title={open ? 'Pause this session' : 'Start a session to pause it'}
          className={cx(base, 'w-11 border-yellow/45 bg-yellow/10 px-0 text-yellow')}
        >
          <PauseGlyph />
        </button>
      )}
      {open ? (
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          title="Stop this session"
          aria-label="Stop Session"
          className={cx(base, 'w-11 px-0 sm:w-auto sm:px-4', 'border-red/45 bg-red/10 text-red')}
        >
          <span className="sm:hidden">
            <StopGlyph />
          </span>
          <span className="hidden sm:inline">{ending ? 'Stopping…' : 'Stop Session'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          title="Start a session to begin logging"
          className={cx(base, 'border-green/45 bg-green/10 text-green')}
        >
          {starting ? 'Starting…' : 'Start Session'}
        </button>
      )}
    </div>
  )
}
