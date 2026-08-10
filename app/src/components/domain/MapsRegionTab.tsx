import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EmptyState } from '../ui/EmptyState'
import { Overlay } from '../ui/Overlay'
import { MapImageViewer } from './MapImageViewer'
import { MapPin, markerColor } from './MapPin'
import { DeleteMapButton } from './DeleteMapButton'
import { MapMarkerEditRow } from './MapMarkerEditRow'
import { MapPositionSidebar } from './MapPositionSidebar'
import type { MapPositionUpdate } from './MapPositionSidebar'
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
 * the Region tab's own image+pin, markers, and upload/replace/delete-map
 * controls; travel-position state lives in `MapPositionSidebar`. Owns
 * its own interaction state (in-flight saves, marker selection) since
 * none of it is shared with Site or Scene; results get lifted to
 * `MapsPanel` via `onPositionUpdate`/`onMapUploaded`/`onMapCleared` so
 * the tab bar's badge state and the Site tab's own data stay independent
 * copies, not one shared blob.
 *
 * Layout (2026-08-10, desktop-scroll follow-up): a two-column grid at
 * `xl:` — map on the left, everything else (position sidebar, upload,
 * delete) in a fixed-width column on the right — collapsing to one
 * stacked column below `xl:` for the mobile "Maps" tab, same breakpoint
 * `Overlay.tsx` already uses for its own dialog/sheet split. The marker
 * editor is no longer inline content at all; it opens as its own
 * `Overlay` dialog (per the user's "add marker should open its own
 * window" feedback), which also trims a chunk of permanent vertical
 * stacking that was forcing the desktop scroll in the first place.
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
  const [movingPin, setMovingPin] = useState(false)

  const [label, setLabel] = useState(map?.label ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [markers, setMarkers] = useState<CampaignMapMarker[]>([])
  const [placingMarker, setPlacingMarker] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [markerSaving, setMarkerSaving] = useState(false)

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

  // Rethrows on failure (after reporting it) — see `MapPositionSidebar`'s
  // doc comment for why: it's what tells the sidebar to leave its edit
  // row open for a retry instead of closing as if the save succeeded.
  async function handleSavePosition(update: MapPositionUpdate) {
    try {
      onPositionUpdate(await setPartyPosition(campaignId, update))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the party position.')
      throw err
    }
  }

  async function handleSaveMarker(markerId: string, update: { label: string; markerKind: MarkerKind; notes: string }) {
    setMarkerSaving(true)
    try {
      const updated = await updateMapMarker(markerId, { label: update.label, markerKind: update.markerKind, notes: update.notes || undefined })
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="flex flex-col gap-2">
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
            <EmptyState icon="map" title="No region map yet" description="Upload a hex map to show the party's position and travel state here." />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <MapPositionSidebar position={position} onSave={handleSavePosition} />

          <div className="flex flex-col gap-2">
            <TextInput label="Map label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The Gloaming" className="w-full" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : map ? 'Replace map' : 'Upload map'}
              </Button>
              {map && <DeleteMapButton onConfirm={handleDeleteMap} />}
            </div>
          </div>
        </div>
      </div>

      {selectedMarker && (
        <Overlay open onClose={() => setSelectedMarkerId(null)} header={<h3 className={text.h3}>Marker</h3>} width="narrow">
          <MapMarkerEditRow
            marker={selectedMarker}
            saving={markerSaving}
            onSave={(update) => void handleSaveMarker(selectedMarker.id, update)}
            onDelete={() => void handleDeleteMarker(selectedMarker.id)}
          />
        </Overlay>
      )}
    </div>
  )
}
