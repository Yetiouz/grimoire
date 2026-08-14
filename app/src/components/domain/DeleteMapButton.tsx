import { useState } from 'react'
import { text } from '../../lib/typography'
import { cx } from '../../lib/cx'

interface DeleteMapButtonProps {
  onConfirm: () => Promise<void>
  /** Button copy (default 'Delete map'). Added for slice 4's handout
   * controls (2026-08-14) — `MapsRegionTab`/`MapsSiteTab` now have TWO
   * delete affordances in the same panel (the working map, and its
   * optional handout), and "Delete map" twice on one screen with no way
   * to tell which is which would be a real usability bug, not just
   * inconsistent copy. */
  label?: string
  /** Confirmation-row copy (default "Delete this map? This can't be
   * undone."). */
  confirmText?: string
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
 *
 * Generic enough to reuse for handout deletion too (slice 4) despite
 * the component's name — `onConfirm` is the only thing that actually
 * differs (`clearCampaignMap` vs `clearMapHandout`), so this stays one
 * component with copy props rather than forking into two nearly
 * identical ones.
 */
export function DeleteMapButton({ onConfirm, label = 'Delete map', confirmText = "Delete this map? This can't be undone." }: DeleteMapButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={text.label} style={{ color: 'var(--color-red)' }}>
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-red/35 bg-panel px-3 py-2">
      <span className={cx(text.caption, 'text-ink-dim')}>{confirmText}</span>
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
