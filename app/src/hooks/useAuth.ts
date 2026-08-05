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
 * don't each reach into `supabase.auth` directly. GitHub OAuth only in
 * v1 (SPEC: "the owner is the only user"); email magic-link joins
 * arrive with Milestone 2. */
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

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { ...state, signInWithGitHub, signOut }
}
