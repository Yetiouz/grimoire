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
 * toggles between pause (yellow, ⏸) and resume (green, ▶) depending on
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
          ▶
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
          ⏸
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
          <span className="sm:hidden" aria-hidden="true">■</span>
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
