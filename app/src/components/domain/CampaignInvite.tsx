import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { ensureCampaignJoinCode } from '../../lib/campaigns'

interface CampaignInviteProps {
  campaignId: string
}

/** Owner-only "Invite" control (2026-08-11, "I may want to play a
 * different character with my friends") — the campaign-owner side of
 * the new join-by-code flow (migration 0023); `CampaignList.tsx`'s
 * "Have an invite code?" is the redeeming half. Lazily fetches/creates
 * this campaign's one persistent `join_code` on first open rather than
 * on mount — nothing needs the code before someone actually clicks
 * Invite, and `ensure_campaign_join_code` is idempotent, so opening
 * this repeatedly can't ever mint a second code or invalidate one
 * already handed out.
 *
 * Only rendered by the caller when `isOwner` (see `JournalScreen.tsx`)
 * — the RPC itself also enforces owner-only server-side, so this is
 * purely keeping a control off the screen for players who could never
 * use it, not the actual security boundary. */
export function CampaignInvite({ campaignId }: CampaignInviteProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setOpen(true)
    setCopied(false)
    if (code) return
    setLoading(true)
    setError(null)
    try {
      setCode(await ensureCampaignJoinCode(campaignId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the invite code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can fail (permission denied, insecure context)
      // — the code is already shown on screen either way, so this is a
      // convenience failure, not one worth surfacing as an error.
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => void handleOpen()}>
        Invite
      </Button>
      {open && (
        <Modal
          title="Invite a friend"
          onCancel={() => setOpen(false)}
          onConfirm={() => void handleCopy()}
          cancelLabel="Close"
          confirmLabel={copied ? 'Copied!' : 'Copy code'}
        >
          {error ? (
            <p className="text-red">{error}</p>
          ) : (
            <>
              <p>Share this code — anyone signed in can enter it to join as a player.</p>
              <p className={cx(text.dataDisplay, 'mt-3 text-center tracking-[0.3em]')}>{loading || !code ? '········' : code}</p>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
