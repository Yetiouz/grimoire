import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { StyleGuide } from './pages/style-guide/StyleGuide'
import { SignIn } from './pages/auth/SignIn'
import { CampaignList } from './pages/campaigns/CampaignList'
import { JournalScreen } from './pages/journal/JournalScreen'
import { cx } from './lib/cx'
import { text } from './lib/typography'
import type { Campaign } from './lib/campaigns'

/** No router yet (SPEC's Journal v1 plan: "plain state is fine for v1"
 * — deep-linkable URLs are a noted fast-follow). Three screens driven
 * by plain useState. `/style-guide` stays reachable as a bare pathname
 * check, the same escape hatch the design-system stage used before
 * real screens existed. */
function App() {
  if (window.location.pathname === '/style-guide') {
    return <StyleGuide />
  }

  return <AuthGate />
}

/** Sign-in gate plus the campaign-list ↔ journal state machine — split
 * out from App so the `/style-guide` early return above never touches
 * auth at all. */
function AuthGate() {
  const { user, loading, signOut } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  if (loading) {
    return <div className={cx('flex min-h-screen items-center justify-center', text.bodySecondary)}>Loading…</div>
  }

  if (!user) {
    return <SignIn />
  }

  if (campaign) {
    return (
      <JournalScreen
        campaign={campaign}
        authorName={authorName(user)}
        // Real ownership check (2026-08-11, join-by-code pass) —
        // `campaign.owner` is the real `campaigns.owner` uuid column,
        // `user.id` the signed-in Supabase auth user's own id, both
        // already on hand here. Gates `JournalHeader`'s Invite control;
        // see `JournalScreen.tsx`'s own doc comment on the `isOwner`
        // prop for why this is computed here rather than passed down
        // as a display string the way `authorName` is.
        isOwner={campaign.owner === user.id}
        onBack={() => setCampaign(null)}
      />
    )
  }

  // CampaignList owns its own PageHeader (same self-contained pattern
  // JournalScreen already uses) rather than App rendering a generic one
  // from outside — the "New Campaign" button lives in the header's
  // titleAction slot now, right next to the h1, and that button's
  // click handler/modal state live inside CampaignList itself.
  return <CampaignList onOpenCampaign={setCampaign} onSignOut={() => void signOut()} />
}

/** Display name for a signed-in user (SPEC: "minimal profile: display
 * name"). GitHub OAuth gives `user_name` (the handle); falls back to a
 * full name or email if that's ever missing, and finally a generic
 * label rather than rendering "undefined" in the journal. */
function authorName(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const metadata = user.user_metadata ?? {}
  return (metadata.user_name as string | undefined) ?? (metadata.full_name as string | undefined) ?? user.email ?? 'Player'
}

export default App
