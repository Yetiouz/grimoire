import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  /** True until the initial session check resolves — distinct from
   * "user is null because signed out," so callers can show a loading
   * state instead of flashing the sign-in screen on every page load. */
  loading: boolean
}

/** The one auth hook — wraps Supabase's session/user state so screens
 * don't each reach into `supabase.auth` directly.
 *
 * Two sign-in paths as of 2026-08-11 ("I don't want to use the github
 * for everyone... maybe github should be used like the admin
 * password"): GitHub OAuth (original v1 path, unchanged) plus email
 * magic link (was deferred to "Milestone 2" in the original SPEC
 * comment here — moved up because requiring a GitHub account turned
 * out to actually exclude every non-technical player from trying the
 * app at all, not just add friction). Both land in the exact same
 * `AuthGate` afterward (`App.tsx` doesn't branch on which provider
 * signed someone in) — this is only about who can get in the door, not
 * a permissions split. A magic-link account gets its own fully
 * isolated campaign exactly like a GitHub account does today; there's
 * still no invite/join-a-campaign feature, so this doesn't let two
 * people share one campaign — see `SignIn.tsx`'s own doc comment. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGitHub() {
    // Explicit redirectTo — without it, Supabase falls back to the
    // project's static Auth "Site URL" setting regardless of where the
    // app is actually running, which is what sent a local dev session
    // to a dead port. `window.location.origin` makes this correct on
    // both local dev and every deployed target, as long as that origin
    // is also in Supabase's Additional Redirect URLs allow-list
    // (Authentication → URL Configuration) — Supabase won't honor an
    // arbitrary redirectTo that isn't allow-listed.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  // Magic link, not a password: `signInWithOtp` with no `password`
  // option emails a click-to-sign-in link rather than a code to type
  // back in. Same `redirectTo`/allow-list reasoning as
  // `signInWithGitHub` above — this needs the app's deployed origin in
  // Supabase's Additional Redirect URLs too, plus its own separate
  // "Email" provider toggle (Authentication → Providers) that GitHub
  // sign-in never depended on. Neither of those is a migration or app
  // code change — nothing reachable from this session's tools flips
  // them; they're a one-time Supabase dashboard setting.
  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { ...state, signInWithGitHub, signInWithEmail, signOut }
}
