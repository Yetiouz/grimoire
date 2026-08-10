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
 * new color. JournalScreen still owns every command call; this
 * component only renders state and forwards clicks.
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
          className={cx(base, 'border-red/45 bg-red/10 text-red')}
        >
          {ending ? 'Stopping…' : 'Stop Session'}
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
