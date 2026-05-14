// Stripe client + helpers.
//
// All billing surfaces (checkout, billing portal, webhook signature
// verification) go through here. The client is initialised lazily so the
// test suite + envs without billing configured still boot. Anything calling
// these helpers MUST be willing to surface a 500 if STRIPE_SECRET_KEY is
// missing — that's a deploy-time misconfiguration, not a runtime user error.

import StripeSdk from "stripe";
import type { Stripe as StripeClass } from "stripe/cjs/stripe.core.js";

// The CJS package entry-point exports a callable constructor whose
// attached namespace only re-exports `Stripe` as a *type alias* — it
// doesn't flatten the inner type namespace. Pulling the class+namespace
// directly from `stripe.core` gives us `Event`, `Checkout.Session`,
// `Subscription`, etc. as typed members.
type StripeEvent = StripeClass.Event;
type StripeCheckoutSession = StripeClass.Checkout.Session;
type StripeBillingPortalSession = StripeClass.BillingPortal.Session;

export type Tier = "trial" | "starter" | "professional" | "enterprise";
export type PaidTier = Exclude<Tier, "trial">;

let cached: StripeClass | null = null;

export function getStripe(): StripeClass {
    if (cached) return cached;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error(
            "STRIPE_SECRET_KEY is not configured. Set it in the backend env before calling billing endpoints.",
        );
    }
    // No explicit apiVersion — let the SDK use its pinned default to avoid
    // type drift when the env-side dashboard version differs from the
    // installed SDK. Stripe's library is forward-compatible.
    cached = new StripeSdk(key);
    return cached;
}

export function getWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error(
            "STRIPE_WEBHOOK_SECRET is not configured. Set it before exposing /api/billing/webhook.",
        );
    }
    return secret;
}

/**
 * Resolve the env-configured Stripe Price ID for a paid tier.
 * Throws if the relevant env var is unset — surfaces config drift
 * immediately rather than failing inside Stripe with a "no such price".
 */
export function getPriceIdForTier(tier: PaidTier): string {
    const envName =
        tier === "starter"
            ? "STRIPE_PRICE_STARTER"
            : tier === "professional"
              ? "STRIPE_PRICE_PROFESSIONAL"
              : "STRIPE_PRICE_ENTERPRISE";
    const value = process.env[envName];
    if (!value) {
        throw new Error(`${envName} is not configured`);
    }
    return value;
}

const TIER_BY_PRICE_ENV: Record<string, PaidTier> = {
    STRIPE_PRICE_STARTER: "starter",
    STRIPE_PRICE_PROFESSIONAL: "professional",
    STRIPE_PRICE_ENTERPRISE: "enterprise",
};

/**
 * Reverse lookup: given a Stripe Price ID we saw on a subscription, map it
 * back to a tier. Used by the webhook so a plan change in the Stripe
 * dashboard propagates to `subscriptions.tier`.
 */
export function tierForPriceId(priceId: string): PaidTier | null {
    for (const [envName, tier] of Object.entries(TIER_BY_PRICE_ENV)) {
        if (process.env[envName] === priceId) return tier;
    }
    return null;
}

const TIER_TOKEN_LIMITS: Record<Tier, number> = {
    trial: 1_000_000,
    starter: 10_000_000,
    professional: 35_000_000,
    enterprise: 100_000_000,
};

export function tokenLimitForTier(tier: Tier): number {
    return TIER_TOKEN_LIMITS[tier];
}

/**
 * Create a Stripe Checkout Session for the chosen paid tier. The user's
 * Supabase ID is attached via `client_reference_id` AND `metadata.user_id`
 * — webhook handlers prefer metadata because it survives through
 * `customer.subscription.*` events that don't include `client_reference_id`.
 */
export async function createCheckoutSession(params: {
    userId: string;
    email: string | null | undefined;
    tier: PaidTier;
    returnUrl: string;
    cancelUrl: string;
}): Promise<StripeCheckoutSession> {
    const stripe = getStripe();
    const priceId = getPriceIdForTier(params.tier);
    return stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.email ?? undefined,
        client_reference_id: params.userId,
        subscription_data: {
            metadata: {
                user_id: params.userId,
                tier: params.tier,
            },
        },
        metadata: {
            user_id: params.userId,
            tier: params.tier,
        },
        allow_promotion_codes: true,
    });
}

/**
 * Create a Billing Portal Session so customers can manage their plan,
 * payment method, and cancellation themselves. Requires a Stripe Customer
 * ID — caller must have it from the `subscriptions` row.
 */
export async function createBillingPortalSession(params: {
    stripeCustomerId: string;
    returnUrl: string;
}): Promise<StripeBillingPortalSession> {
    const stripe = getStripe();
    return stripe.billingPortal.sessions.create({
        customer: params.stripeCustomerId,
        return_url: params.returnUrl,
    });
}

/**
 * Verify the Stripe-Signature header on a raw request body. Throws if the
 * signature doesn't match — the webhook handler returns 400 in that case.
 */
export function constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string,
): StripeEvent {
    const stripe = getStripe();
    return stripe.webhooks.constructEvent(
        rawBody,
        signature,
        getWebhookSecret(),
    );
}

/**
 * Visible for tests so they can swap in a stub without poking process.env
 * mid-suite.
 */
export function __resetStripeCacheForTests(): void {
    cached = null;
}
