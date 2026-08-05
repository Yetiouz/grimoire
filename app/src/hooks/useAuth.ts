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
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { ...state, signInWithGitHub, signOut }
}
