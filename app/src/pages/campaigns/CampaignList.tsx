import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TextInput } from '../../components/ui/TextInput'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { createCampaign, joinCampaignByCode, listCampaignsWithLastEntry } from '../../lib/campaigns'
import type { Campaign, CampaignWithLastEntry, GmMode } from '../../lib/campaigns'
import { GmModeSelector } from '../../components/domain/GmModeSelector'

interface CampaignListProps {
  onOpenCampaign: (campaign: Campaign) => void
  onSignOut: () => void
}

function formatLastEntry(iso: string | null): string {
  if (!iso) return 'No entries yet'
  return `Last entry ${new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

/** Screen 1 of Journal v1 (SPEC): Panel cards, each showing name +
 * last-entry time; "New Campaign" opens a Modal with a name field —
 * `system` stays hidden, defaulted to 'shadowdark' server-side — plus a
 * `GmModeSelector` (owner request, 2026-08-15: "i want one when
 * starting a campaign. and a toggle.") so gm_mode no longer silently
 * defaults to 'solo' for every new campaign with no way to choose
 * otherwise.
 *
 * "Have an invite code?" (2026-08-11, migration 0023, "I may want to
 * play a different character with my friends") is the redeeming half
 * of `CampaignInvite.tsx`'s owner-side control — a second small button
 * next to New Campaign, since joining someone else's campaign and
 * starting your own are the two ways a signed-in user with no
 * campaigns yet actually gets somewhere from this screen. Reuses the
 * same `Modal`/`TextInput` shape as New Campaign for consistency
 * rather than inventing a second pattern for "type a short string,
 * confirm."
 */
export function CampaignList({ onOpenCampaign, onSignOut }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithLastEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [gmMode, setGmMode] = useState<GmMode>('solo')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Deliberately no synchronous setState in here — error-clearing on
    // retry lives in the ErrorBanner's onRetry event handler instead.
    // (react-hooks/set-state-in-effect flags the effect call site
    // regardless; see the eslint-disable there.)
    try {
      const data = await listCampaignsWithLastEntry()
      setCampaigns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading your campaigns.')
    }
  }, [])

  useEffect(() => {
    // Mount/param-change data fetch — the one canonical effect use.
    // react-hooks/set-state-in-effect statically flags ANY setState
    // reachable from a function called in the effect body, even calls
    // that only run after an await (the rule doesn't model async
    // boundaries), so fetch-on-mount needs a targeted opt-out here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createCampaign(trimmed, gmMode)
      setModalOpen(false)
      setName('')
      setGmMode('solo')
      onOpenCampaign(created)
    } catch (err) {
      // Local to the modal (matching handleJoin's joinError), not the
      // page-level `error`/ErrorBanner — that banner renders behind the
      // Modal's own opaque backdrop, so a failure reported through it
      // while this modal is still open was invisible: the button just
      // silently reverted from "Creating…" to "Create" with no visible
      // reason why. Bug found auditing the Join modal, which already
      // got this right, against Create, which didn't.
      setCreateError(err instanceof Error ? err.message : 'Could not create the campaign.')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    const trimmed = joinCode.trim()
    if (!trimmed) return
    setJoining(true)
    setJoinError(null)
    try {
      const joined = await joinCampaignByCode(trimmed)
      setJoinModalOpen(false)
      setJoinCode('')
      onOpenCampaign(joined)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'That code did not match a campaign.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div>
      {/* CampaignList now owns its own header (same self-contained
       * pattern JournalScreen uses) instead of App rendering a generic
       * one from outside — titleAction puts "New Campaign" (and, as of
       * 2026-08-11, "Have an invite code?") in the same row as the h1,
       * right-aligned next to it, rather than as its own row below the
       * header. */}
      <PageHeader
        left={<span className={text.label}>Grimoire</span>}
        right={
          <button onClick={onSignOut} className={text.label}>
            Sign out
          </button>
        }
        title="Campaigns"
        titleAction={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setJoinModalOpen(true)}>
              Have an invite code?
            </Button>
            <Button onClick={() => setModalOpen(true)}>New Campaign</Button>
          </div>
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        {error && (
          <ErrorBanner
            onRetry={() => {
              setError(null)
              void load()
            }}
          >
            {error}
          </ErrorBanner>
        )}

        {campaigns === null && !error && (
          <SkeletonGroup label="Loading campaigns" className="gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </SkeletonGroup>
        )}

        {campaigns !== null && campaigns.length === 0 && (
          <EmptyState
            icon="journal"
            title="No campaigns yet"
            description="Start one to begin the first session, or join one with an invite code."
            action={<Button onClick={() => setModalOpen(true)}>New Campaign</Button>}
          />
        )}

        {campaigns !== null && campaigns.length > 0 && (
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <Panel key={campaign.id} interactive onClick={() => onOpenCampaign(campaign)}>
                <p className={text.h3}>{campaign.name}</p>
                <p className={text.bodySecondary}>{formatLastEntry(campaign.lastEntryAt)}</p>
              </Panel>
            ))}
          </div>
        )}

        {modalOpen && (
          <Modal
            title="New Campaign"
            onCancel={() => {
              setModalOpen(false)
              setName('')
              setGmMode('solo')
              setCreateError(null)
            }}
            onConfirm={() => void handleCreate()}
            confirmLabel={creating ? 'Creating…' : 'Create'}
          >
            <TextInput
              label="Name"
              value={name}
              onChange={(event: { target: { value: string } }) => setName(event.target.value)}
              placeholder="The Black Road"
              disabled={creating}
              error={createError ?? undefined}
            />
            <div className="mt-4">
              <p className={cx(text.label, 'text-ink-faint')}>GM Mode</p>
              <GmModeSelector value={gmMode} onChange={setGmMode} className="mt-1.5" />
            </div>
          </Modal>
        )}

        {joinModalOpen && (
          <Modal
            title="Join a campaign"
            onCancel={() => {
              setJoinModalOpen(false)
              setJoinCode('')
              setJoinError(null)
            }}
            onConfirm={() => void handleJoin()}
            confirmLabel={joining ? 'Joining…' : 'Join'}
          >
            <TextInput
              label="Invite code"
              value={joinCode}
              onChange={(event: { target: { value: string } }) => setJoinCode(event.target.value)}
              placeholder="e.g. 7F3K9QAB"
              disabled={joining}
              error={joinError ?? undefined}
            />
          </Modal>
        )}
      </div>
    </div>
  )
}
