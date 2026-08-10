import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EmptyState } from '../ui/EmptyState'
import { MapImageViewer } from './MapImageViewer'
import { MapPin, markerColor } from './MapPin'
import { DeleteMapButton } from './DeleteMapButton'
import { MapMarkerEditRow } from './MapMarkerEditRow'
import {
  addMapMarker,
  clearCampaignMap,
  listMapMarkers,
  removeMapMarker,
  setPartyPosition,
  updateMapMarker,
  uploadCampaignMap,
} from '../../lib/maps'
import type { CampaignMap, CampaignMapMarker, CampaignMapPosition, MarkerKind } from '../../lib/maps'

interface MapsRegionTabProps {
  campaignId: string
  map: CampaignMap | null
  imageUrl: string | undefined
  position: CampaignMapPosition | null
  onPositionUpdate: (position: CampaignMapPosition) => void
  onMapUploaded: (map: CampaignMap) => void
  onMapCleared: (kind: 'region') => void
  onError: (message: string) => void
}

/** Split out of `MapsPanel.tsx` (CLAUDE.md's ~300-line component cap) —
 * the Region tab's own image+pin, travel chips, edit row, markers, and
 * upload/replace/delete-map controls. Owns its own interaction state
 * (edit-row open/closed, in-flight saves, marker selection) since none
 * of it is shared with Site or Scene; results get lifted to `MapsPanel`
 * via `onPositionUpdate`/`onMapUploaded`/`onMapCleared` so the tab bar's
 * badge state and the Site tab's own data stay independent copies, not
 * one shared blob.
 *
 * Markers are fetched here rather than in `MapsPanel` — unlike
 * `maps`/`position`, they're only ever read by the tab that owns their
 * `kind`, so there's no cross-tab state to keep in sync the way image
 * URLs are.
 *
 * Click-to-act on the map has two modes, never both live at once:
 * plain click moves the party pin (the original behavior); "+ Marker"
 * arms one-shot marker-placement so the next click drops a marker
 * instead — same distinction `MapImageViewer` itself doesn't need to
 * know about, since it only ever reports "the map was clicked here."
 */
export function MapsRegionTab({ campaignId, map, imageUrl, position, onPositionUpdate, onMapUploaded, onMapCleared, onError }: MapsRegionTabProps) {
  const [editing, setEditing] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [paceInput, setPaceInput] = useState('')
  const [hexesInput, setHexesInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [movingPin, setMovingPin] = useState(false)

  const [label, setLabel] = useState(map?.label ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [markers, setMarkers] = useState<CampaignMapMarker[]>([])
  const [placingMarker, setPlacingMarker] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [markerSaving, setMarkerSaving] = useState(false)

  useEffect(() => {
    setLocationInput(position?.location_label ?? '')
    setPaceInput(position?.travel_pace ?? '')
    setHexesInput(position?.hexes_remaining != null ? String(position.hexes_remaining) : '')
  }, [position])

  useEffect(() => {
    setLabel(map?.label ?? '')
  }, [map])

  useEffect(() => {
    let cancelled = false
    listMapMarkers(campaignId, 'region')
      .then((data) => {
        if (!cancelled) setMarkers(data)
      })
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Could not load markers.'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  async function handleMapClick(x: number, y: number) {
    if (placingMarker) {
      setPlacingMarker(false)
      try {
        const marker = await addMapMarker(campaignId, { kind: 'region', x, y, label: 'New marker' })
        setMarkers((prev) => [...prev, marker])
        setSelectedMarkerId(marker.id)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not add the marker.')
      }
      return
    }
    setMovingPin(true)
    try {
      onPositionUpdate(await setPartyPosition(campaignId, { x, y }))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not move the party pin.')
    } finally {
      setMovingPin(false)
    }
  }

  async function handleClearPin() {
    try {
      onPositionUpdate(await setPartyPosition(campaignId, { clearPin: true }))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not clear the party pin.')
    }
  }

  async function handleSaveMarker(markerId: string, update: { label: string; markerKind: MarkerKind; notes: string }) {
    setMarkerSaving(true)
    try {
      const updated = await updateMapMarker(markerId, {
        label: update.label,
        markerKind: update.markerKind,
        notes: update.notes || undefined,
      })
      setMarkers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      setSelectedMarkerId(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the marker.')
    } finally {
      setMarkerSaving(false)
    }
  }

  async function handleDeleteMarker(markerId: string) {
    try {
      await removeMapMarker(markerId)
      setMarkers((prev) => prev.filter((m) => m.id !== markerId))
      setSelectedMarkerId(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete the marker.')
    }
  }

  async function handleDeleteMap() {
    try {
      await clearCampaignMap(campaignId, 'region', map?.storage_path)
      onMapCleared('region')
      setMarkers([])
      setSelectedMarkerId(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete the map.')
    }
  }

  // Blank fields are omitted, not sent as `null`: `set_party_position`
  // coalesces a null argument to "leave the stored value alone" (a
  // partial update — bumping just hexesRemaining — shouldn't require
  // resending location/pace too). That means this form can't clear a
  // field to empty via Save; only the pin's x/y has real clear
  // semantics (the "Clear pin" button below).
  async function handleSavePosition() {
    setSaving(true)
    try {
      const updated = await setPartyPosition(campaignId, {
        locationLabel: locationInput.trim() || undefined,
        travelPace: paceInput.trim() || undefined,
        hexesRemaining: hexesInput.trim() === '' ? undefined : Number(hexesInput),
      })
      onPositionUpdate(updated)
      setEditing(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the party position.')
    } finally {
      setSaving(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    const fallbackLabel = file.name.replace(/\.[^.]+$/, '')
    uploadCampaignMap(campaignId, 'region', label.trim() || fallbackLabel, file)
      .then(onMapUploaded)
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Could not upload the map image.'))
      .finally(() => setUploading(false))
  }

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null

  return (
    <div className="flex flex-col gap-3">
      {map && imageUrl ? (
        <>
          <MapImageViewer src={imageUrl} alt={map.label} onImageClick={(x, y) => void handleMapClick(x, y)}>
            {position?.x != null && position?.y != null && (
              <MapPin x={position.x} y={position.y} color="var(--color-purple)" pulsing label="Party position" />
            )}
            {markers.map((marker) => (
              <MapPin
                key={marker.id}
                x={marker.x}
                y={marker.y}
                color={markerColor(marker.marker_kind)}
                label={marker.label}
                onClick={() => setSelectedMarkerId(marker.id)}
              />
            ))}
          </MapImageViewer>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={text.label}>{placingMarker ? 'Click the map to drop a marker.' : movingPin ? 'Moving pin…' : 'Click the map to move the party pin.'}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPlacingMarker((v) => !v)} className={text.label} style={placingMarker ? { color: 'var(--color-purple)' } : undefined}>
                {placingMarker ? 'Cancel marker' : '+ Marker'}
              </button>
              <button type="button" onClick={() => void handleClearPin()} className={text.label}>
                Clear pin
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon="map" title="No region map yet" description="Upload a hex map below to show the party's position and travel state here." />
      )}

      {selectedMarker && (
        <MapMarkerEditRow
          marker={selectedMarker}
          saving={markerSaving}
          onSave={(update) => void handleSaveMarker(selectedMarker.id, update)}
          onDelete={() => void handleDeleteMarker(selectedMarker.id)}
          onClose={() => setSelectedMarkerId(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line-soft bg-panel px-3 py-2.5">
        {position?.location_label ? (
          <span className={cx(text.caption, 'inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink')}>
            <span className="h-1.5 w-1.5 rounded-full bg-purple" aria-hidden="true" />
            <span className="font-semibold">{position.location_label}</span>
          </span>
        ) : (
          <span className={text.bodySecondary}>No location set yet.</span>
        )}
        {position?.travel_pace && <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink-dim')}>{position.travel_pace}</span>}
        {position?.hexes_remaining != null && (
          <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink-dim')}>
            {position.hexes_remaining} {position.hexes_remaining === 1 ? 'hex' : 'hexes'} remaining
          </span>
        )}
        <button type="button" onClick={() => setEditing((v) => !v)} className={cx(text.label, 'ml-auto')} style={{ color: 'var(--color-purple)' }}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>

      {editing && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-line-soft bg-panel px-3 py-3">
          <div className="min-w-[10rem] flex-1">
            <TextInput label="Location" value={locationInput} onChange={(e) => setLocationInput(e.target.value)} className="w-full" />
          </div>
          <div className="min-w-[10rem] flex-1">
            <TextInput label="Pace" value={paceInput} onChange={(e) => setPaceInput(e.target.value)} placeholder="e.g. Walking, normal terrain" className="w-full" />
          </div>
          <div className="w-28">
            <TextInput label="Hexes left" type="number" min={0} value={hexesInput} onChange={(e) => setHexesInput(e.target.value)} className="w-full" />
          </div>
          <Button variant="primary" onClick={() => void handleSavePosition()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <TextInput label="Map label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The Gloaming" className="w-full" />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : map ? 'Replace map' : 'Upload map'}
          </Button>
        </div>
        {map && <DeleteMapButton onConfirm={handleDeleteMap} />}
      </div>
    </div>
  )
}
