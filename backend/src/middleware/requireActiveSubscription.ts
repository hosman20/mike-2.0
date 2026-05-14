// Paywall middleware for AI endpoints.
//
// Runs AFTER `requireAuth` — relies on `res.locals.userId` being set.
// Returns 402 Payment Required with a structured `reason` so the frontend
// interceptor can route the user to /pricing or surface a token-limit
// upsell. The shape MUST stay stable — the frontend axios/fetch handler
// inspects `error` + `reason` to decide what to do.

import type { NextFunction, Request, Response } from "express";
import { createServerSupabase } from "../lib/supabase";
import { isDevAuthBypass } from "../lib/devAuth";

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
    const db = createServerSupabase();
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

function reject(res: Response, reason: PaywallReason): void {
    res.status(402).json({
        error: "payment_required",
        reason,
        upgrade_url: "/pricing",
    });
}

function toNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Factory so tests can inject a mocked Supabase lookup without touching
 * the global module cache.
 */
export function createRequireActiveSubscription(
    lookup: SubscriptionLookup = defaultLookup,
) {
    return async function requireActiveSubscription(
        _req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        // Dev-only bypass: skip the subscription lookup entirely. Hard-gated
        // by NODE_ENV !== 'production' inside `isDevAuthBypass`.
        if (isDevAuthBypass) {
            next();
            return;
        }

        const userId = res.locals.userId as string | undefined;
        if (!userId) {
            // `requireAuth` must run first — guard against accidental
            // mis-ordering in route wiring.
            res.status(401).json({ detail: "Unauthorized" });
            return;
        }

        const sub = await lookup(userId);
        if (!sub) {
            reject(res, "no_subscription");
            return;
        }

        const limit = toNumber(sub.monthly_token_limit);
        const used = toNumber(sub.tokens_used_this_period);
        const overLimit = limit > 0 && used >= limit;

        if (sub.status === "active") {
            if (overLimit) {
                reject(res, "token_limit_reached");
                return;
            }
            next();
            return;
        }

        if (sub.status === "trialing") {
            const trialEndsAt = sub.trial_ends_at
                ? new Date(sub.trial_ends_at).getTime()
                : 0;
            if (!trialEndsAt || trialEndsAt <= Date.now()) {
                reject(res, "trial_expired");
                return;
            }
            if (overLimit) {
                reject(res, "token_limit_reached");
                return;
            }
            next();
            return;
        }

        reject(res, "subscription_inactive");
    };
}

export const requireActiveSubscription = createRequireActiveSubscription();
