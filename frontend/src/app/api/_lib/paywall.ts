// Paywall check for Next.js API route handlers.
//
// Ported verbatim from `backend/src/middleware/requireActiveSubscription.ts`.
// Same `PaywallReason` values, same 402 response shape, same dev bypass
// rules. Returns `null` on pass and a `NextResponse` 402 on fail so the
// caller can do:
//
//     const blocked = await requireActiveSubscription(userId);
//     if (blocked) return blocked;
//
// The response shape `{error, reason, upgrade_url}` is contract-stable —
// the frontend axios/fetch interceptor inspects `error` + `reason` to
// decide whether to redirect to /pricing or surface a token-limit upsell.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase";

export type PaywallReason =
    | "no_subscription"
    | "trial_expired"
    | "subscription_inactive"
    | "token_limit_reached";

export type SubscriptionRow = {
    id: string;
    tier: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    monthly_token_limit: number | string | null;
    tokens_used_this_period: number | string | null;
};

type SubscriptionLookup = (
    userId: string,
) => Promise<SubscriptionRow | null>;

const defaultLookup: SubscriptionLookup = async (userId) => {
    const db: SupabaseClient = createServerSupabase();
    const { data, error } = await db
        .from("subscriptions")
        .select(
            "id, tier, status, trial_ends_at, current_period_end, monthly_token_limit, tokens_used_this_period",
        )
        .eq("user_id", userId)
        .maybeSingle();
    if (error) return null;
    return (data as SubscriptionRow | null) ?? null;
};

function reject(reason: PaywallReason): NextResponse {
    return NextResponse.json(
        {
            error: "payment_required",
            reason,
            upgrade_url: "/pricing",
        },
        { status: 402 },
    );
}

function toNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

function isDevAuthBypass(): boolean {
    return (
        process.env.NODE_ENV !== "production" &&
        process.env.DEV_AUTH_BYPASS === "1"
    );
}

/**
 * Factory so tests can inject a mocked Supabase lookup without touching
 * the global module cache.
 */
export function createRequireActiveSubscription(
    lookup: SubscriptionLookup = defaultLookup,
) {
    return async function requireActiveSubscription(
        userId: string,
    ): Promise<NextResponse | null> {
        if (isDevAuthBypass()) return null;

        if (!userId) {
            return NextResponse.json(
                { detail: "Unauthorized" },
                { status: 401 },
            );
        }

        const sub = await lookup(userId);
        if (!sub) return reject("no_subscription");

        const limit = toNumber(sub.monthly_token_limit);
        const used = toNumber(sub.tokens_used_this_period);
        const overLimit = limit > 0 && used >= limit;

        if (sub.status === "active") {
            if (overLimit) return reject("token_limit_reached");
            return null;
        }

        if (sub.status === "trialing") {
            const trialEndsAt = sub.trial_ends_at
                ? new Date(sub.trial_ends_at).getTime()
                : 0;
            if (!trialEndsAt || trialEndsAt <= Date.now()) {
                return reject("trial_expired");
            }
            if (overLimit) return reject("token_limit_reached");
            return null;
        }

        return reject("subscription_inactive");
    };
}

export const requireActiveSubscription = createRequireActiveSubscription();
