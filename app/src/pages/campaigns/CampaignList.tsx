import { useEffect, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TextInput } from '../../components/ui/TextInput'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Skeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { text } from '../../lib/typography'
import { createCampaign, listCampaignsWithLastEntry } from '../../lib/campaigns'
import type { Campaign, CampaignWithLastEntry } from '../../lib/campaigns'

interface CampaignListProps {
  onOpenCampaign: (campaign: Campaign) => void
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
 * last-entry time; "New Campaign" opens a Modal with a name field only
 * — `system` stays hidden, defaulted to 'shadowdark' server-side. */
export function CampaignList({ onOpenCampaign }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithLastEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setError(null)
    try {
      const data = await listCampaignsWithLastEntry()
      setCampaigns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong loading your campaigns.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const created = await createCampaign(trimmed)
      setModalOpen(false)
      setName('')
      onOpenCampaign(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the campaign.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      {/* "Campaigns" itself now lives in the shared PageHeader band
       * (App.tsx's AuthGate) alongside Sign out — this row is just the
       * page's primary action, not a heading row anymore. */}
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>New Campaign</Button>
      </div>

      {error && (
        <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>
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
          description="Start one to begin the first session."
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
          />
        </Modal>
      )}
    </div>
  )
}
