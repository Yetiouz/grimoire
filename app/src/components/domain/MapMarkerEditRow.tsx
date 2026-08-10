import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import type { CampaignMapMarker, MarkerKind } from '../../lib/maps'

const MARKER_KIND_OPTIONS: MarkerKind[] = ['poi', 'npc', 'danger', 'custom']

interface MapMarkerEditRowProps {
  marker: CampaignMapMarker
  saving: boolean
  onSave: (update: { label: string; markerKind: MarkerKind; notes: string }) => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Inline edit form for one selected marker — label, `marker_kind`
 * (a plain button group over the closed four-value set, same "pick one
 * of a few named options" shape as `MapsRegionTab`'s pace chips, not a
 * `<select>`), and free-text notes. Shared by `MapsRegionTab`/
 * `MapsSiteTab` rather than duplicated since both tabs' markers are the
 * same `campaign_map_markers` shape with only `kind` (region/site)
 * differing, which this row never touches.
 */
export function MapMarkerEditRow({ marker, saving, onSave, onDelete, onClose }: MapMarkerEditRowProps) {
  const [label, setLabel] = useState(marker.label)
  const [markerKind, setMarkerKind] = useState<MarkerKind>(marker.marker_kind as MarkerKind)
  const [notes, setNotes] = useState(marker.notes ?? '')

  useEffect(() => {
    setLabel(marker.label)
    setMarkerKind(marker.marker_kind as MarkerKind)
    setNotes(marker.notes ?? '')
  }, [marker])

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-soft bg-panel px-3 py-3">
      <div className="flex items-center justify-between">
        <span className={text.label}>Edit marker</span>
        <button type="button" onClick={onClose} className={text.label}>
          Close
        </button>
      </div>

      <TextInput label="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full" />

      <div className="flex flex-wrap gap-1.5">
        {MARKER_KIND_OPTIONS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setMarkerKind(kind)}
            className={cx(
              text.caption,
              'rounded-full border px-3 py-1 capitalize',
              kind === markerKind ? 'border-line-hover bg-panel2 text-ink' : 'border-line-soft text-ink-dim hover:border-line-hover',
            )}
          >
            {kind}
          </button>
        ))}
      </div>

      <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={saving} onClick={() => onSave({ label: label.trim() || marker.label, markerKind, notes: notes.trim() })}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <button type="button" onClick={onDelete} className={text.label} style={{ color: 'var(--color-red)' }}>
          Delete marker
        </button>
      </div>
    </div>
  )
}
