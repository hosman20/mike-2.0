// Server-side token-usage tracking for the paywall — ported verbatim
// from `backend/src/lib/billing/usage.ts`.
//
// Called from AI route handlers AFTER a stream finishes — never in the
// hot path. Failures are logged and swallowed so a bookkeeping error
// never breaks a user-visible response. Caller convention is
// fire-and-forget: `void recordTokenUsage(userId, total)`.

import { createServerSupabase } from "../supabase";

/**
 * Add `tokens` to the user's current-period usage.
 *
 * Uses a read-modify-write rather than a SQL increment because the
 * Supabase JS client doesn't expose `+= n` arithmetic on update without
 * a stored procedure. The race is benign — under-counting a few tokens
 * during concurrent streams is acceptable and the next call catches up
 * the deficit.
 */
export async function recordTokenUsage(
    userId: string,
    totalTokens: number,
): Promise<void> {
    if (!userId || !Number.isFinite(totalTokens) || totalTokens <= 0) return;
    try {
        const db = createServerSupabase();
        const { data, error } = await db
            .from("subscriptions")
            .select("id, tokens_used_this_period")
            .eq("user_id", userId)
            .maybeSingle();
        if (error || !data) return;
        const current = Number(data.tokens_used_this_period ?? 0);
        const next = current + Math.round(totalTokens);
        await db
            .from("subscriptions")
            .update({
                tokens_used_this_period: next,
                updated_at: new Date().toISOString(),
            })
            .eq("id", data.id);
    } catch (err) {
        console.warn("[billing/usage] recordTokenUsage failed", err);
    }
}
