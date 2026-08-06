import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

interface SessionActionProps {
  open: boolean
  starting: boolean
  ending: boolean
  onStart: () => void
  onEnd: () => void
}

/**
 * v11 (SPEC decision log): the session button IS the session indicator —
 * no separate status dot. "Start Session" renders green-tinted when no
 * session is open; "Stop Session" renders red-tinted while one is; a
 * yellow pause square sits beside it as a disabled structural stub
 * (sessions have no paused state in the schema yet — it ships with the
 * session-states work, not silently before it). Tint pattern matches
 * DangerBanner's tone treatment (color/12 bg, color/45 border) rather
 * than solid indicator fills, per the "color lives in accents" rule.
 * JournalScreen still owns the start/end command calls.
 */
export function SessionAction({ open, starting, ending, onStart, onEnd }: SessionActionProps) {
  const base = cx(
    'inline-flex h-11 items-center justify-center rounded-button border px-4 font-mono uppercase',
    text.caption,
    'transition-[background-color,border-color,opacity] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  )

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled
        aria-label="Pause session (coming with session states)"
        title="Pause — coming soon"
        className={cx(base, 'w-11 border-yellow/45 bg-yellow/10 px-0 text-yellow')}
      >
        ⏸
      </button>
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
