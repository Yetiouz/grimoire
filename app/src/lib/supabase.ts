import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly and immediately rather than let `createClient` construct a
// client against `undefined` — that fails opaquely later, deep inside a
// network call, instead of here with a message that says exactly what's
// missing. Copy `.env.example` to `.env.local` (gitignored) with the
// values from the Supabase dashboard, or set them in Vercel's project
// env vars for a deploy.
if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy app/.env.example to app/.env.local and fill in the values from the Supabase dashboard (Project Settings → API).',
  )
}

/** The one Supabase client for the app — every data/auth call goes
 * through this, not a fresh `createClient` per file. No generated
 * `Database` type yet (no tables exist — `generate_typescript_types`
 * has nothing to generate from until the first migration lands). */
export const supabase = createClient(url, anonKey)
