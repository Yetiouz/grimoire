import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { deriveStatusIndicator } from '../../lib/statusTone'
import { StatusDot } from '../ui/StatusDot'
import type { Location, LocationSecret } from '../../lib/world'

interface LocationCardProps {
  location: Location
  /** From `WorldTabs`' `listLocationSecrets` map, keyed by `location_id` —
   * `undefined` for both "this location genuinely has no hidden content"
   * and "the viewer isn't the campaign owner and RLS filtered it out."
   * Those two cases render identically (no GM section at all) by design —
   * same shape as `NpcCard`'s `statBlock` prop; see that component's own
   * doc comment. No separate `isGm` prop needed here either. */
  secret?: LocationSecret
  className?: string
}

// `kind` carries a Postgres CHECK constraint (settlement/region/site),
// not a real enum type, so the generated type is plain `string` — this
// map is a display-only lookup, not an exhaustiveness guarantee. Falls
// back to the raw value for anything unrecognized (defensive, same
// "don't render nothing for a real value we didn't expect" reasoning
// `GM_MODE_LABEL` in `JournalScreen.tsx` already uses), though the
// CHECK constraint means that shouldn't happen in practice.
const KIND_LABEL: Record<string, string> = {
  settlement: 'Settlement',
  region: 'Region',
  site: 'Adventure Site',
}

/** One location — the detail-view shape, matching `NpcCard`/`FactionCard`
 * exactly (name + status dot header, a kind caption, the player-known
 * summary, then — GM only, and only when one exists — a hidden-content
 * section). Migration `0024_locations` (BUILD_PLAN.md item 15 slice 1):
 * replaces `world.md`'s Settlements/Regions/Adventure Sites, each of
 * which already drew this exact "known" vs. "hidden" line by hand.
 *
 * Unlike `NpcStatBlockSection`, the GM section here is plain prose, not
 * a structured stat block — `location_secrets.notes` is a `text` column
 * (world.md's "Hidden: ..." lines are freeform sentences, not fielded
 * data like an NPC's AC/HP), so there's nothing to parse into named
 * fields. */
export function LocationCard({ location, secret, className }: LocationCardProps) {
  const statusIndicator = deriveStatusIndicator(location.status)

  return (
    <div className={cx('rounded-card border border-line-soft bg-panel2 px-3 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cx(text.body, 'font-semibold')}>{location.name}</span>
        {statusIndicator && <StatusDot {...statusIndicator} />}
      </div>
      <p className={cx(text.caption, 'mt-0.5 text-ink-dim')}>{KIND_LABEL[location.kind] ?? location.kind}</p>
      {location.summary && <p className={cx(text.bodySecondary, 'mt-2')}>{location.summary}</p>}

      {secret && (
        <div className="mt-2.5 rounded-lg border border-purple/25 bg-panel px-2.5 py-2">
          <p className={cx(text.label, 'text-purple')}>⛨ GM only — hidden</p>
          <p className={cx(text.caption, 'mt-1.5 text-ink')}>{secret.notes}</p>
        </div>
      )}
    </div>
  )
}
