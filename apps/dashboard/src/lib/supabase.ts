import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db-types';

// Server-side Supabase client. Uses the anon key — RLS is not yet wired
// up (see CLAUDE.md), so anon currently has full read access on all tables.
//
// When we add RLS, dashboard server components will switch to a request-
// scoped client that carries the supplier's JWT.
export function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'See apps/dashboard/.env.local.',
    );
  }

  return createClient<Database>(url, anonKey);
}
