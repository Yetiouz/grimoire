import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'

interface SessionActionProps {
  open: boolean
  starting: boolean
  ending: boolean
  onStart: () => void
  onEnd: () => void
}

/**
 * Journal's header session control — used to be one button doing double
 * duty ("start the next session" was also the only way to end this one,
 * Amendment 2's original design). Real use showed that wasn't enough:
 * there was no way to just stop for the night without immediately
 * opening a new, empty next session. Now two distinct actions, each
 * wired to its own command: "Start Session" when nothing's open, or a
 * live indicator plus a real "End Session" button (the `end_session`
 * command) when one is. Still no "pause" — ending closes the session
 * for good, same as before; resuming means starting a new one.
 *
 * Split out of `JournalScreen.tsx` in the visual-reconciliation pass
 * (pure line-count housekeeping to stay under CLAUDE.md's ~300-line
 * cap, same motivation as the earlier DiceRoller split — this component
 * carries no state of its own, `JournalScreen` still owns the
 * start/end command calls and session state).
 */
export function SessionAction({ open, starting, ending, onStart, onEnd }: SessionActionProps) {
  if (open) {
    return (
      <div className="flex items-center gap-3">
        <span className={cx(text.label, 'flex items-center gap-2')}>
          <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
          In Session
        </span>
        <Button variant="ghost" onClick={onEnd} disabled={ending} title="End this session">
          {ending ? 'Ending…' : 'End Session'}
        </Button>
      </div>
    )
  }

  return (
    <Button variant="ghost" onClick={onStart} disabled={starting} title="Start a session to begin logging">
      {starting ? 'Starting…' : 'Start Session'}
    </Button>
  )
}
