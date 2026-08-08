import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import type { GmTurnResult } from '../../lib/gm'

/** The reply strip. Three tones, matching the three families of outcome
 * the edge function reports: an answer, a brake that fired, and "you
 * can't do this right now". None of them are errors in the throwing
 * sense — see `gm.ts`.
 *
 * Successful replies normally do NOT appear here anymore: they are
 * written into the journal and render in the feed instead. This shows
 * only what has nowhere else to go — which now includes the case where
 * the GM answered but the journal write failed, so the answer isn't
 * lost just because it couldn't be filed. */
export function GmReply({ result, onDismiss }: { result: GmTurnResult; onDismiss: () => void }) {
  const unfiled = result.status === 'ok' && result.logged === false

  const tone =
    result.status === 'ok'
      ? 'gm'
      : result.status === 'budget_exhausted' || result.status === 'error'
        ? 'bad'
        : 'stop'

  const label = unfiled ? 'Not filed' : tone === 'gm' ? 'GM' : tone === 'bad' ? 'Budget' : 'Stopped'

  return (
    <div
      role="status"
      className={cx(
        'flex items-start gap-2.5 rounded-card border px-3 py-2.5',
        tone === 'gm' && 'border-cyan/30 bg-cyan/[0.07]',
        tone === 'stop' && 'border-yellow/30 bg-yellow/[0.07]',
        tone === 'bad' && 'border-red/30 bg-red/[0.07]',
      )}
    >
      <span
        className={cx(
          text.label,
          'mt-px shrink-0 rounded px-1.5 py-0.5',
          tone === 'gm' && 'bg-cyan/15 text-cyan',
          tone === 'stop' && 'bg-yellow/15 text-yellow',
          tone === 'bad' && 'bg-red/15 text-red',
        )}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx(text.body, 'block')}>{result.message}</span>
        <span className={cx(text.label, 'mt-1 block text-ink-faint')}>
          {result.requestCount} {result.requestCount === 1 ? 'request' : 'requests'}
          {result.providerMode === 'stub' && ' · stub'}
          {unfiled && ' · could not be written to the journal — copy it if you want to keep it'}
          {result.resetsAt && ` · resets ${new Date(result.resetsAt).toLocaleTimeString()}`}
        </span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 leading-none text-ink-faint hover:text-ink-dim"
      >
        ×
      </button>
    </div>
  )
}
