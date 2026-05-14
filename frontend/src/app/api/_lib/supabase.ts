// Server-side Supabase client for Next.js API route handlers.
//
// Mirrors `backend/src/lib/supabase.ts` so the Next-side API routes hit
// Supabase with the same service-role credentials and RLS-bypass posture
// as the legacy Express backend. Reads env vars `SUPABASE_URL` and
// `SUPABASE_SECRET_KEY` (NOT the `NEXT_PUBLIC_*` browser-exposed pair).
//
// Throws a clear error if either env var is missing — failing fast at
// the call site is preferable to a confusing "fetch failed" later.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key.
 * Bypasses RLS — only call from API routes after verifying the user.
 */
export function createServerSupabase(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SECRET_KEY ?? "";
    if (!url || !key) {
        throw new Error(
            "createServerSupabase: missing SUPABASE_URL or SUPABASE_SECRET_KEY env var",
        );
    }
    return createClient(url, key, { auth: { persistSession: false } });
}
