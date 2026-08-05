import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

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
 * through this, not a fresh `createClient` per file. Typed against
 * `database.types.ts` (generated from the `grimoire` project after
 * migrations 0001–0003, journal v1) so `.from('journal_entries')`,
 * `.rpc('log_journal_entry', ...)` etc. are all checked against the
 * real schema — app and database can't silently drift apart. Regenerate
 * that file after every schema change, per CLAUDE.md. */
export const supabase = createClient<Database>(url, anonKey)
