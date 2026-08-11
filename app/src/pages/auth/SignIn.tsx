import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/TextInput'
import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'
import { useAuth } from '../../hooks/useAuth'

/** Two sign-in paths (2026-08-11, "I don't want to use the github for
 * everyone... maybe github should be used like the admin password") —
 * GitHub OAuth is unchanged from v1 and stays available (nothing here
 * hides or blocks it; whoever already uses it can keep using it
 * exactly as before). Email magic link is the new second path, for
 * anyone who shouldn't need a GitHub account just to try the app.
 *
 * Both paths land in the exact same place afterward — `AuthGate` in
 * `App.tsx` reads `user` from `useAuth()` and doesn't know or care
 * which provider signed someone in. This is purely about who can get
 * in the door, not a permissions split: a magic-link account gets its
 * own fully isolated campaign exactly like a GitHub account does today
 * (own `campaign_members` rows, own RLS-scoped view, own GM budget
 * pool — see `lib/campaigns.ts`/`create_campaign`). There is still no
 * invite/join-a-campaign feature, so this doesn't let a friend join an
 * *existing* campaign (yours or anyone else's) — only sign in and
 * start their own, same as today. That's a separate, bigger feature if
 * it's ever wanted.
 *
 * Needs one thing this session's tools can't do: the Supabase
 * dashboard's Email provider must be turned on (Authentication →
 * Providers → Email) and this app's deployed origin must be in
 * Additional Redirect URLs (Authentication → URL Configuration) — the
 * second one's likely already true since GitHub sign-in depends on the
 * same allow-list, but Email is its own separate provider toggle that
 * GitHub never needed. */
export function SignIn() {
  const { signInWithGitHub, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || status === 'sending') return
    setStatus('sending')
    setError(null)
    try {
      await signInWithEmail(trimmed)
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.')
      setStatus('idle')
    }
  }

  return (
    // `min-h-svh` (small-viewport height), not `min-h-screen` (100vh):
    // the landing page's own hero already hit and fixed this exact bug
    // (see index.html's `.hero{min-height:100svh}`) — plain 100vh gets
    // inflated by the mobile browser's address-bar chrome, so a page
    // that visually fits still gets a few px of scroll. `svh` is
    // guaranteed to fit even with the chrome visible.
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      {/* Illuminated-G mark above the wordmark, matching the landing
       * page's hero exactly (`hero-logo-mark` above `hero-wordmark`).
       * `logo.webp` copied into app/public/ — the app is a separate
       * Vercel deploy target from the landing page and doesn't share
       * its static files. */}
      <img src="/logo.webp" alt="Grimoire logo — an illuminated letter G" className="h-auto w-[160px] max-w-[50vw]" />
      <h1 className={text.display}>Grimoire</h1>
      <p className={text.bodySecondary}>Sign in to open your campaigns.</p>

      <Button onClick={() => void signInWithGitHub()}>Continue with GitHub</Button>

      <div className="flex w-full max-w-xs items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className={cx(text.label, 'text-ink-faint')}>or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {status === 'sent' ? (
        <p className={cx(text.bodySecondary, 'max-w-xs')} role="status">
          Check <span className="text-ink">{email}</span> for a sign-in link.
        </p>
      ) : (
        <form onSubmit={(event) => void handleEmailSubmit(event)} className="flex w-full max-w-xs flex-col gap-3">
          <TextInput
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error ?? undefined}
            aria-label="Email address"
          />
          <Button type="submit" variant="ghost" disabled={status === 'sending' || !email.trim()}>
            {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </Button>
        </form>
      )}
    </div>
  )
}
