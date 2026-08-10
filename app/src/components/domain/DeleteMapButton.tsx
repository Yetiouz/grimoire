import { useState } from 'react'
import { text } from '../../lib/typography'
import { cx } from '../../lib/cx'

interface DeleteMapButtonProps {
  onConfirm: () => Promise<void>
}

/**
 * Two-step "Delete map" control shared by `MapsRegionTab`/`MapsSiteTab` —
 * the first click only arms a confirmation row (label + Cancel/Delete),
 * the second click is what actually calls `clearCampaignMap`. Deleting a
 * map image is an irreversible, destructive action (no undo — the
 * storage object and the `campaign_maps` row are both gone), so this
 * intentionally doesn't fire on a single click the way "Replace map"
 * does; a native `window.confirm()` would do the same job but blocks the
 * whole page, so an inline row matches every other confirmation surface
 * in this app instead (e.g. the travel position edit row's own
 * open/closed toggle).
 */
export function DeleteMapButton({ onConfirm }: DeleteMapButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={text.label} style={{ color: 'var(--color-red)' }}>
        Delete map
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-red/35 bg-panel px-3 py-2">
      <span className={cx(text.caption, 'text-ink-dim')}>Delete this map? This can't be undone.</span>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          setDeleting(true)
          void onConfirm().finally(() => {
            setDeleting(false)
            setConfirming(false)
          })
        }}
        className={cx(text.label, 'disabled:opacity-40')}
        style={{ color: 'var(--color-red)' }}
      >
        {deleting ? 'Deleting…' : 'Confirm delete'}
      </button>
      <button type="button" disabled={deleting} onClick={() => setConfirming(false)} className={cx(text.label, 'disabled:opacity-40')}>
        Cancel
      </button>
    </div>
  )
}
