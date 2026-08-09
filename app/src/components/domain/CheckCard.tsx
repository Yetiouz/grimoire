import { useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import type { Advantage, GmCheck, ResolveSource } from '../../lib/checks'

interface CheckCardProps {
  check: GmCheck
  /** True while THIS check's resolution is in flight. Keyed by the host
   * comparing `check.id` rather than a bare screen-wide boolean — 0017's
   * own invariant means at most one check is ever pending per campaign,
   * but keying it still means a stale in-flight state from an abandoned
   * check can never disable a different card's controls. */
  resolving?: boolean
  /** Omit to render a read-only card (no roll/physical controls even
   * while pending) — matches every other feed control's convention
   * (`onSaveAsNote`, `onAskGm`) of an optional handler the host may
   * simply not wire up. */
  onResolve?: (check: GmCheck, source: ResolveSource, total?: number) => void
  className?: string
}

const ADVANTAGE_LABEL: Record<Advantage, string> = {
  advantage: 'Advantage',
  disadvantage: 'Disadvantage',
}

/** Owner's pick (Slice 17 mockup, variant A — "feed-native"): same
 * visual weight as a narration entry, a quiet purple accent bar the
 * only thing marking it as an action rather than prose. Pending shows
 * both the roll button and the physical-total field as first-class
 * controls (SLICE_17_SPEC.md: "the roll flow is button OR physical
 * dice, both first-class... dice are never taken from the player"),
 * resolved recedes to a single quiet line (the actual outcome text is
 * its own narration entry the database already wrote — see
 * `resolve_check`'s SQL — immediately below this card in the feed, not
 * duplicated here), and abandoned mutes further still. `bands` is never
 * present on this object at all (`gm_list_checks` withholds it) — there
 * is no path through this component that could leak an unrevealed
 * outcome. */
export function CheckCard({ check, resolving = false, onResolve, className }: CheckCardProps) {
  const [physicalTotal, setPhysicalTotal] = useState('')
  const pending = check.status === 'pending'
  const abandoned = check.status === 'abandoned'
  const interactive = pending && Boolean(onResolve)

  const meta = [
    check.ability,
    `DC ${check.dc}`,
    check.advantage ? ADVANTAGE_LABEL[check.advantage] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  function submitPhysical() {
    const trimmed = physicalTotal.trim()
    const total = Number(trimmed)
    if (!trimmed || !Number.isFinite(total)) return
    onResolve?.(check, 'physical', total)
    setPhysicalTotal('')
  }

  return (
    <div
      className={cx(
        'rounded-card border-l-[3px] border border-line-soft bg-panel px-3.5 py-3',
        abandoned ? 'border-l-line-hover opacity-55' : 'border-l-purple',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cx(
            text.label,
            'rounded-full border border-purple/35 bg-purple/[0.08] px-2.5 py-0.5 text-purple',
          )}
        >
          Check
        </span>
        {meta && <span className={cx(text.caption, 'text-ink-dim')}>{meta}</span>}
      </div>

      {check.stakes && <p className={cx(text.bodySecondary, 'mt-1 max-w-[60ch]')}>{check.stakes}</p>}

      <div className="mt-2.5">
        {abandoned ? (
          <p className={cx(text.caption, 'italic text-ink-faint')}>Superseded by a later check — never rolled.</p>
        ) : !pending ? (
          <p className={cx(text.caption, 'flex items-center gap-2 text-ink-dim')}>
            <span className="text-green" aria-hidden="true">
              ✓
            </span>
            {check.resolved_source === 'physical'
              ? `Total ${check.resolved_total} (physical) vs DC ${check.dc} — resolved`
              : `Rolled ${check.resolved_total} (server) vs DC ${check.dc} — resolved`}
          </p>
        ) : resolving ? (
          <Button type="button" variant="primary" disabled>
            Rolling…
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="primary"
              disabled={!interactive}
              onClick={() => onResolve?.(check, 'server')}
            >
              Roll d20
            </Button>
            <span className={cx(text.label, 'text-ink-faint')}>or</span>
            <TextInput
              type="number"
              inputMode="numeric"
              value={physicalTotal}
              disabled={!interactive}
              onChange={(event: { target: { value: string } }) => setPhysicalTotal(event.target.value)}
              onKeyDown={(event: { key: string }) => {
                if (event.key === 'Enter') submitPhysical()
              }}
              placeholder="Total"
              aria-label="Enter your physical roll total"
              className="w-20"
            />
            <Button type="button" variant="ghost" disabled={!interactive || !physicalTotal.trim()} onClick={submitPhysical}>
              Log
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
