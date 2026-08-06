import { Button } from '../../components/ui/Button'
import { text } from '../../lib/typography'
import { useAuth } from '../../hooks/useAuth'

/** GitHub OAuth only in v1 (SPEC: "the owner is the only user"; email
 * magic-link joins arrive with Milestone 2). */
export function SignIn() {
  const { signInWithGitHub } = useAuth()

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
    </div>
  )
}
