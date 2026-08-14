import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EmptyState } from '../ui/EmptyState'
import { Overlay } from '../ui/Overlay'
import { MapImageViewer } from './MapImageViewer'
import { MapPin, markerColor } from './MapPin'
import { DeleteMapButton } from './DeleteMapButton'
import { MapMarkerEditRow } from './MapMarkerEditRow'
import {
  addMapMarker,
  clearCampaignMap,
  clearMapHandout,
  listMapMarkers,
  removeMapMarker,
  updateMapMarker,
  uploadCampaignMap,
  uploadMapHandout,
} from '../../lib/maps'
import type { CampaignMap, CampaignMapMarker, MarkerKind } from '../../lib/maps'

interface MapsSiteTabProps {
  campaignId: string
  map: CampaignMap | null
  imageUrl: string | undefined
  /** See `MapsRegionTab`'s identical prop for the full doc comment —
   * same handout mechanism, same display-swap rule, shared here rather
   * than re-explained. */
  handoutImageUrl: string | undefined
  isOwner: boolean
  onMapUploaded: (map: CampaignMap) => void
  onMapCleared: (kind: 'site') => void
  onError: (message: string) => void
}

/** Split out of `MapsPanel.tsx` alongside `MapsRegionTab` (CLAUDE.md's
 * ~300-line cap). Simpler than Region: one illustrated location (e.g.
 * Dreg's Ford), no pin/travel state — just the image, zoom/pan, markers,
 * and its label. Shares `MapImageViewer`/`MapPin`/`DeleteMapButton`/
 * `MapMarkerEditRow` with `MapsRegionTab` rather than duplicating them,
 * including the same two-column desktop layout (map | sidebar,
 * collapsing to one column below `xl:`) and the marker editor opening as
 * its own `Overlay` dialog instead of an inline row — see
 * `MapsRegionTab`'s doc comment for why. The "+Marker" click-to-place
 * toggle is used here too even though Site has no party pin to
 * disambiguate against, so the two tabs read as one consistent
 * interaction language rather than two different ones. */
export function MapsSiteTab({ campaignId, map, imageUrl, handoutImageUrl, isOwner, onMapUploaded, onMapCleared, onError }: MapsSiteTabProps) {
  const [label, setLabel] = useState(map?.label ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [handoutUploading, setHandoutUploading] = useState(false)
  const handoutFileInputRef = useRef<HTMLInputElement>(null)

  // See `MapsRegionTab`'s identical block for the full reasoning.
  const displayImageUrl = isOwner ? imageUrl : (handoutImageUrl ?? imageUrl)
  const showingHandout = !isOwner && Boolean(handoutImageUrl)

  const [markers, setMarkers] = useState<CampaignMapMarker[]>([])
  const [placingMarker, setPlacingMarker] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [markerSaving, setMarkerSaving] = useState(false)

  useEffect(() => {
    setLabel(map?.label ?? '')
  }, [map])

  useEffect(() => {
    let cancelled = false
    listMapMarkers(campaignId, 'site')
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
    if (!placingMarker) return
    setPlacingMarker(false)
    try {
      const marker = await addMapMarker(campaignId, { kind: 'site', x, y, label: 'New marker' })
      setMarkers((prev) => [...prev, marker])
      setSelectedMarkerId(marker.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add the marker.')
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
      await clearCampaignMap(campaignId, 'site', map?.storage_path, map?.handout_storage_path ?? undefined)
      onMapCleared('site')
      setMarkers([])
      setSelectedMarkerId(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete the map.')
    }
  }

  function handleHandoutFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !map) return
    setHandoutUploading(true)
    uploadMapHandout(campaignId, 'site', file)
      .then(onMapUploaded)
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Could not upload the handout image.'))
      .finally(() => setHandoutUploading(false))
  }

  async function handleClearHandout() {
    try {
      onMapUploaded(await clearMapHandout(campaignId, 'site', map?.handout_storage_path ?? undefined))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not remove the handout.')
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    const fallbackLabel = file.name.replace(/\.[^.]+$/, '')
    uploadCampaignMap(campaignId, 'site', label.trim() || fallbackLabel, file)
      .then(onMapUploaded)
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Could not upload the map image.'))
      .finally(() => setUploading(false))
  }

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="flex flex-col gap-2">
          {map && displayImageUrl ? (
            <>
              {showingHandout && (
                <span className={cx(text.caption, 'inline-flex w-fit items-center gap-1.5 rounded-full border border-green/45 px-2.5 py-0.5 uppercase tracking-eyebrow text-green')}>
                  <span className="h-1.5 w-1.5 rounded-full bg-green" />
                  Player map
                </span>
              )}
              <MapImageViewer src={displayImageUrl} alt={map.label} onImageClick={(x, y) => void handleMapClick(x, y)}>
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
                <h4 className={text.body}>{map.label}</h4>
                <button type="button" onClick={() => setPlacingMarker((v) => !v)} className={text.label} style={placingMarker ? { color: 'var(--color-purple)' } : undefined}>
                  {placingMarker ? 'Click the map to drop a marker' : '+ Marker'}
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon="map" title="No site map yet" description="Upload an illustrated location (e.g. Dreg's Ford) to show it here." />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <TextInput label="Map label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dreg's Ford" className="w-full" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : map ? 'Replace map' : 'Upload map'}
              </Button>
              {map && <DeleteMapButton onConfirm={handleDeleteMap} />}
            </div>
          </div>

          {isOwner && map && (
            <div className="flex flex-col gap-2 rounded-card border border-line-soft bg-panel px-3 py-2.5">
              <span className={cx(text.label, 'text-ink-faint')}>Player handout</span>
              <p className={cx(text.caption, 'text-ink-dim')}>
                {map.handout_storage_path
                  ? 'Players see this instead of the map above.'
                  : 'Not set — players currently see the same map you do.'}
              </p>
              {map.handout_storage_path && handoutImageUrl && (
                <img src={handoutImageUrl} alt="Player handout preview" className="h-20 w-full rounded-button border border-line-soft object-cover" />
              )}
              <input ref={handoutFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleHandoutFileChange} />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onClick={() => handoutFileInputRef.current?.click()} disabled={handoutUploading}>
                  {handoutUploading ? 'Uploading…' : map.handout_storage_path ? 'Replace handout' : 'Upload handout'}
                </Button>
                {map.handout_storage_path && (
                  <DeleteMapButton onConfirm={handleClearHandout} label="Remove handout" confirmText="Remove this handout? Players will see the working map again." />
                )}
              </div>
            </div>
          )}
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
