import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import type { CampaignMapPosition } from '../../lib/maps'

export interface MapPositionUpdate {
  locationLabel?: string
  travelPace?: string
  hexesRemaining?: number
}

interface MapPositionSidebarProps {
  position: CampaignMapPosition | null
  /** Does the actual `setPartyPosition` call and `onPositionUpdate`
   * lift-up; rethrows on failure (after already reporting it via the
   * tab's own `onError`) purely so this component knows to leave the
   * edit row open for a retry rather than closing it as if the save had
   * succeeded — same "stay open on error" behavior the inline version
   * of this form had before it was split out. */
  onSave: (update: MapPositionUpdate) => Promise<void>
}

/** Region tab's travel-state sidebar block — location/pace/hexes chips
 * plus the edit row — split out of `MapsRegionTab.tsx` (CLAUDE.md's
 * ~300-line cap) once the two-column desktop layout pushed it over.
 * Owns its own edit-row open/closed and field state; the actual API
 * call and error reporting stay with the caller via `onSave`, same
 * division of labor `MapMarkerEditRow` uses. */
export function MapPositionSidebar({ position, onSave }: MapPositionSidebarProps) {
  const [editing, setEditing] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [paceInput, setPaceInput] = useState('')
  const [hexesInput, setHexesInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local edit state to the position prop
    setLocationInput(position?.location_label ?? '')
    setPaceInput(position?.travel_pace ?? '')
    setHexesInput(position?.hexes_remaining != null ? String(position.hexes_remaining) : '')
  }, [position])

  // Blank fields are omitted, not sent as `null`: `set_party_position`
  // coalesces a null argument to "leave the stored value alone" (a
  // partial update — bumping just hexesRemaining — shouldn't require
  // resending location/pace too). That means this form can't clear a
  // field to empty via Save; only the pin's x/y has real clear
  // semantics (the Region tab's separate "Clear pin" button).
  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        locationLabel: locationInput.trim() || undefined,
        travelPace: paceInput.trim() || undefined,
        hexesRemaining: hexesInput.trim() === '' ? undefined : Number(hexesInput),
      })
      setEditing(false)
    } catch {
      // Already surfaced via the caller's onError — just leave the row
      // open so the user can fix and retry instead of losing their input.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-card border border-line-soft bg-panel px-3 py-2.5">
        {position?.location_label ? (
          <span className={cx(text.caption, 'inline-flex w-fit items-center gap-1.5 rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink')}>
            <span className="h-1.5 w-1.5 rounded-full bg-purple" aria-hidden="true" />
            <span className="font-semibold">{position.location_label}</span>
          </span>
        ) : (
          <span className={text.bodySecondary}>No location set yet.</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {position?.travel_pace && <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink-dim')}>{position.travel_pace}</span>}
          {position?.hexes_remaining != null && (
            <span className={cx(text.caption, 'rounded-full border border-line-soft bg-panel2 px-3 py-1 text-ink-dim')}>
              {position.hexes_remaining} {position.hexes_remaining === 1 ? 'hex' : 'hexes'} remaining
            </span>
          )}
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className={cx(text.label, 'w-fit')} style={{ color: 'var(--color-purple)' }}>
          {editing ? 'Close' : 'Edit position'}
        </button>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 rounded-card border border-line-soft bg-panel px-3 py-3">
          <TextInput label="Location" value={locationInput} onChange={(e) => setLocationInput(e.target.value)} className="w-full" />
          <TextInput label="Pace" value={paceInput} onChange={(e) => setPaceInput(e.target.value)} placeholder="e.g. Walking, normal terrain" className="w-full" />
          <TextInput label="Hexes left" type="number" min={0} value={hexesInput} onChange={(e) => setHexesInput(e.target.value)} className="w-full" />
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </>
  )
}
