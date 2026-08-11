import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { ensureCampaignJoinCode } from '../../lib/campaigns'

interface CampaignInviteModalProps {
  campaignId: string
  open: boolean
  onClose: () => void
}

/** The invite-code fetch/copy/display logic, split out of what used to
 * be `CampaignInvite`'s own internal state (2026-08-11, "fix the
 * Campaign tools tile") — the mobile Tools tab's "Invite" tile
 * (`MobileJournalView`) needed to open the exact same modal a second,
 * independent way, and `CampaignInvite`'s original shape had no trigger
 * but its own hardcoded Button. The desktop header's ghost button and
 * the mobile tile are two different triggers for the identical
 * `ensure_campaign_join_code` flow, not two features, so this is the
 * one shared piece both now mount with their own open state.
 *
 * Owner-only in practice — both call sites gate on `isOwner` before
 * ever mounting this — but this component itself doesn't re-check that;
 * same "the RPC is the real security boundary, the caller just keeps a
 * dead control off screen for players who could never use it" split
 * `CampaignInvite`'s doc comment already documented. */
export function CampaignInviteModal({ campaignId, open, onClose }: CampaignInviteModalProps) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lazily fetches/creates this campaign's one persistent `join_code` on
  // first real open rather than on mount — nothing needs the code before
  // someone actually opens the modal, and `ensure_campaign_join_code` is
  // idempotent, so opening this repeatedly can't ever mint a second code
  // or invalidate one already handed out. Deliberately excludes `code`
  // from the dependency list (only `open` re-triggers this) — including
  // it would refetch on every render once a code exists instead of just
  // reusing the cached one already in state.
  useEffect(() => {
    if (!open || code) return
    setCopied(false)
    setLoading(true)
    setError(null)
    let cancelled = false
    void ensureCampaignJoinCode(campaignId)
      .then((result) => {
        if (!cancelled) setCode(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the invite code.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId])

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
    <Modal
      open={open}
      title="Invite a friend"
      onCancel={onClose}
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
  )
}

interface CampaignInviteProps {
  campaignId: string
}

/** Owner-only "Invite" control for the desktop header
 * (`JournalHeader`'s `inviteAction`, 2026-08-11, "I may want to play a
 * different character with my friends") — the campaign-owner side of
 * the join-by-code flow (migration 0023); `CampaignList.tsx`'s "Have an
 * invite code?" is the redeeming half. Thin wrapper around
 * `CampaignInviteModal` (see that component's own doc comment) that
 * owns just its own open/closed boolean — the mobile Tools tab's
 * "Invite" tile is the other trigger for the same modal, with its own
 * separate open state; the two never share state since they're two
 * different buttons that can each independently be tapped.
 *
 * Only rendered by the caller when `isOwner` (see `JournalScreen.tsx`)
 * — the RPC itself also enforces owner-only server-side, so this is
 * purely keeping a control off the screen for players who could never
 * use it, not the actual security boundary. */
export function CampaignInvite({ campaignId }: CampaignInviteProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Invite
      </Button>
      <CampaignInviteModal campaignId={campaignId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
