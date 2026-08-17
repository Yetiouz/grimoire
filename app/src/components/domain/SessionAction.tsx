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

function PlayGlyph() {
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
 * everywhere, just extended to Stop. Start Session got the same
 * treatment the same day, a follow-up request ("on mobile let's change
 * start session to a matching icon button") — it shares `PlayGlyph`
 * with the Resume button above rather than a second, separately-drawn
 * triangle, since both read as "begin playing" and there's no reason
 * for two subtly different play glyphs in one component. Text labels
 * return at `sm:` and up on both since there's no crowding problem to
 * solve on a wider viewport. The `starting`/`ending`-state "Starting…"/
 * "Stopping…" text is lost on the icon-only mobile buttons during their
 * async calls — same tradeoff the pause button already made
 * everywhere; only `disabled:opacity-40` signals the pending state
 * there too.
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
      {/* Demoted to quiet ghosts at rest (UI review item 5, 2026-08-16,
        * owner-approved mockup + "the colors can be on roll overs"): a
        * permanently red STOP SESSION outranked everything on screen
        * all session long, and ending a session isn't danger — it's
        * routine. Pause/Resume/End now rest neutral (line border, dim
        * ink) and take their tone color on hover only; full red still
        * lives where it belongs, on EndSessionReview's actual confirm.
        * Resume is the one exception kept tinted at rest: a paused
        * session is a state you want visibly flagged, and the green
        * play square IS that flag. Pause gains its word at sm:+ (it
        * was a bare 16px glyph nobody could read); both stay icon-only
        * squares on phones, where the header has no room to spare. */}
      {open && paused ? (
        <button
          type="button"
          onClick={onResume}
          disabled={resuming}
          aria-label="Resume session"
          title="Resume this session"
          className={cx(base, 'border-green/45 bg-green/10 text-green', 'w-11 gap-2 px-0 sm:w-auto sm:px-4')}
        >
          <PlayGlyph />
          <span className="hidden sm:inline">{resuming ? 'Resuming…' : 'Resume'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onPause}
          disabled={!open || pausing}
          aria-label="Pause session"
          title={open ? 'Pause this session' : 'Start a session to pause it'}
          className={cx(
            base,
            'border-line text-ink-dim hover:border-yellow/45 hover:bg-yellow/10 hover:text-yellow',
            'w-11 gap-2 px-0 sm:w-auto sm:px-4',
          )}
        >
          <PauseGlyph />
          <span className="hidden sm:inline">{pausing ? 'Pausing…' : 'Pause'}</span>
        </button>
      )}
      {open ? (
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          title="End this session"
          aria-label="End Session"
          className={cx(
            base,
            'border-line text-ink-dim hover:border-red/45 hover:bg-red/10 hover:text-red',
            'w-11 gap-2 px-0 sm:w-auto sm:px-4',
          )}
        >
          <span className="sm:hidden">
            <StopGlyph />
          </span>
          <span className="hidden sm:inline">{ending ? 'Ending…' : 'End Session'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          title="Start a session to begin logging"
          aria-label="Start Session"
          className={cx(base, 'w-11 px-0 sm:w-auto sm:px-4', 'border-green/45 bg-green/10 text-green')}
        >
          <span className="sm:hidden">
            <PlayGlyph />
          </span>
          <span className="hidden sm:inline">{starting ? 'Starting…' : 'Start Session'}</span>
        </button>
      )}
    </div>
  )
}
