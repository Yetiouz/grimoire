/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project API URL — https://<ref>.supabase.co. Public, not a
   * secret; safe in client bundles. Set in `.env.local` (see
   * `.env.example`) and in Vercel's project env vars for deploys. */
  readonly VITE_SUPABASE_URL: string
  /** Supabase's publishable/anon key. Also not a secret by design — RLS
   * policies are what actually gate access, not this key. */
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
