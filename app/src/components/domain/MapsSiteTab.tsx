import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import { EmptyState } from '../ui/EmptyState'
import { uploadCampaignMap } from '../../lib/maps'
import type { CampaignMap } from '../../lib/maps'

interface MapsSiteTabProps {
  campaignId: string
  map: CampaignMap | null
  imageUrl: string | undefined
  onMapUploaded: (map: CampaignMap) => void
  onError: (message: string) => void
}

/** Split out of `MapsPanel.tsx` alongside `MapsRegionTab` (CLAUDE.md's
 * ~300-line cap). Simpler than Region: one illustrated location (e.g.
 * Dreg's Ford), no pin/travel state — just the image and its label. */
export function MapsSiteTab({ campaignId, map, imageUrl, onMapUploaded, onError }: MapsSiteTabProps) {
  const [label, setLabel] = useState(map?.label ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLabel(map?.label ?? '')
  }, [map])

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

  return (
    <div className="flex flex-col gap-3">
      {map && imageUrl ? (
        <>
          <div className="overflow-hidden rounded-card border border-line-soft bg-black">
            <img src={imageUrl} alt={map.label} className="block w-full" />
          </div>
          <h4 className={text.body}>{map.label}</h4>
        </>
      ) : (
        <EmptyState icon="map" title="No site map yet" description="Upload an illustrated location (e.g. Dreg's Ford) below." />
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <TextInput label="Map label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dreg's Ford" className="w-full" />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : map ? 'Replace map' : 'Upload map'}
        </Button>
      </div>
    </div>
  )
}
