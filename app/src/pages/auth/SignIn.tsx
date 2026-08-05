import { Button } from '../../components/ui/Button'
import { text } from '../../lib/typography'
import { useAuth } from '../../hooks/useAuth'

/** GitHub OAuth only in v1 (SPEC: "the owner is the only user"; email
 * magic-link joins arrive with Milestone 2). */
export function SignIn() {
  const { signInWithGitHub } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className={text.display}>Grimoire</h1>
      <p className={text.bodySecondary}>Sign in to open your campaigns.</p>
      <Button onClick={() => void signInWithGitHub()}>Continue with GitHub</Button>
    </div>
  )
}
