import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EmptyState } from '../ui/EmptyState'
import { setPartyPosition, uploadCampaignMap } from '../../lib/maps'
import type { CampaignMap, CampaignMapPosition } from '../../lib/maps'

interface MapsRegionTabProps {
  campaignId: string
  map: CampaignMap | null
  imageUrl: string | undefined
  position: CampaignMapPosition | null
  onPositionUpdate: (position: CampaignMapPosition) => void
  onMapUploaded: (map: CampaignMap) => void
  onError: (message: string) => void
}

/** Split out of `MapsPanel.tsx` (CLAUDE.md's ~300-line component cap) —
 * the Region tab's own image+pin, travel chips, edit row, and
 * upload/replace control. Owns its own interaction state (edit-row
 * open/closed, in-flight saves) since none of it is shared with Site or
 * Scene; results get lifted to `MapsPanel` via `onPositionUpdate`/
 * `onMapUploaded` so the tab bar's badge state and the Site tab's own
 * data stay independent copies, not one shared blob. */
export function MapsRegionTab({ campaignId, map, imageUrl, position, onPositionUpdate, onMapUploaded, onError }: MapsRegionTabProps) {
  const [editing, setEditing] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [paceInput, setPaceInput] = useState('')
  const [hexesInput, setHexesInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [movingPin, setMovingPin] = useState(false)

  const [label, setLabel] = useState(map?.label ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocationInput(position?.location_label ?? '')
    setPaceInput(position?.travel_pace ?? '')
    setHexesInput(position?.hexes_remaining != null ? String(position.hexes_remaining) : '')
  }, [position])

  useEffect(() => {
    setLabel(map?.label ?? '')
  }, [map])

  async function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
    setMovingPin(true)
    try {
      onPositionUpdate(await setPartyPosition(campaignId, { x, y }))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not move the party pin.')
    } finally {
      setMovingPin(false)
    }
  }

  // Blank fields are omitted, not sent as `null`: `set_party_position`
  // coalesces a null argument to "leave the stored value alone" (a
  // partial update — bumping just hexesRemaining — shouldn't require
  // resending location/pace too). That means this form can't clear a
  // field to empty via Save; only the pin's x/y has real clear
  // semantics (a separate RPC argument, not used by this form).
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

  return (
    <div className="flex flex-col gap-3">
      {map && imageUrl ? (
        <>
          <div className="relative cursor-crosshair overflow-hidden rounded-card border border-line-soft bg-black" onClick={(event) => void handleMapClick(event)}>
            <img src={imageUrl} alt={map.label} className="block w-full" />
            {position?.x != null && position?.y != null && (
              <div className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
                <span className="absolute inset-0 animate-ping rounded-full bg-purple/60" />
                <span className="absolute inset-0 rounded-full border-2 border-bg bg-purple" />
              </div>
            )}
          </div>
          <p className={text.label}>{movingPin ? 'Moving pin…' : 'Click the map to move the party pin.'}</p>
        </>
      ) : (
        <EmptyState icon="map" title="No region map yet" description="Upload a hex map below to show the party's position and travel state here." />
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <TextInput label="Map label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. The Gloaming" className="w-full" />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : map ? 'Replace map' : 'Upload map'}
        </Button>
      </div>
    </div>
  )
}
