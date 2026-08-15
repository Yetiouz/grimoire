import { useEffect, useState } from 'react'
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
 * independent way. The desktop header used to mount its own wrapper
 * (`CampaignInvite`, a ghost button + this modal) as a third trigger,
 * but that wrapper is gone as of the 2026-08-14 header rework
 * ("Option B" — title-led hero row, Invite folded into the hamburger
 * menu instead of sitting in the button row): `JournalHeader` doesn't
 * own a ready-made trigger node anymore, just an `onOpenInvite`
 * callback, so `JournalScreen` now mounts this modal directly with its
 * own lifted `inviteOpen` state — the exact same shape
 * `MobileJournalView` already used for its own tile, not a new pattern.
 * Three call sites, one modal, no duplicated fetch/copy logic.
 *
 * Owner-only in practice — every call site gates on `isOwner` before
 * ever mounting this — but this component itself doesn't re-check that;
 * the RPC (`ensure_campaign_join_code`, migration 0023) is the real
 * security boundary, callers just keep a dead control off screen for
 * players who could never use it. */
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
    if (!open) return
    // Reset the confirm button's label on every open, even when `code`
    // is already cached from a prior open — otherwise a stale
    // "Copied!" from last time leaks into a fresh open and reads as
    // "you already copied this," which isn't true this time around.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-open, the modal convention
    setCopied(false)
    if (code) return
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
