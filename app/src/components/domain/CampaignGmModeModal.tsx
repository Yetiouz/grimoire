import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { GmModeSelector } from './GmModeSelector'
import { updateCampaignGmMode } from '../../lib/campaigns'
import type { Campaign, GmMode } from '../../lib/campaigns'

interface CampaignGmModeModalProps {
  campaign: Campaign
  open: boolean
  onClose: () => void
  /** Echoes `CharacterBuilder`'s own `onCreated` shape (`JournalScreen`'s
   * `handleCharacterCreated`) — the updated row goes straight back to
   * `App.tsx`'s own `setCampaign` rather than this modal owning any
   * campaign state itself, since `campaign` is a prop here, not state. */
  onUpdated: (campaign: Campaign) => void
}

/** The settings half of the owner's 2026-08-15 request ("i want one
 * when starting a campaign. and a toggle.") — `GmModeSelector` plus a
 * Save/Cancel `Modal`, same shape `CampaignInviteModal` already
 * established for an owner-only campaign-settings dialog opened from
 * `JournalHeader`'s hamburger menu. Owner-only in practice (every call
 * site gates on `isOwner` before mounting the trigger, same convention
 * `CampaignInviteModal`'s own doc comment documents) but not re-checked
 * here — `update_campaign_gm_mode` (migration 0033) is the real
 * boundary, this just keeps a dead control off a player's screen. */
export function CampaignGmModeModal({ campaign, open, onClose, onUpdated }: CampaignGmModeModalProps) {
  const [mode, setMode] = useState<GmMode>(campaign.gm_mode as GmMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync to the campaign's real current mode on every open — picks
  // up a change made elsewhere and discards an unsaved pick left over
  // from a prior open that was cancelled, rather than carrying stale
  // local state forward. Same "reset on open, not on mount" shape
  // CampaignInviteModal's own `copied` reset already uses.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-open, the modal convention
    setMode(campaign.gm_mode as GmMode)
    setError(null)
  }, [open, campaign.gm_mode])

  async function handleConfirm() {
    if (mode === campaign.gm_mode) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateCampaignGmMode(campaign.id, mode)
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the GM mode.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="GM Mode"
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
      cancelLabel="Cancel"
      confirmLabel={saving ? 'Saving…' : 'Save'}
    >
      <p>Who's running this campaign?</p>
      <GmModeSelector value={mode} onChange={setMode} className="mt-3" />
      {error && <p className="mt-3 text-red">{error}</p>}
    </Modal>
  )
}
