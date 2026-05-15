// Stripe billing routes.
//
//   POST /api/billing/webhook   (raw body, signature-verified)
//   POST /api/billing/checkout  (auth required)
//   POST /api/billing/portal    (auth required)
//
// The webhook endpoint MUST receive the request body as a Buffer/string
// before any JSON parsing — Stripe signs the raw bytes. The route is
// wired in `src/index.ts` with `express.raw({ type: 'application/json' })`
// scoped to this path BEFORE the global `express.json()` middleware is
// applied to it.

import { Router } from "express";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import {
    constructWebhookEvent,
    createBillingPortalSession,
    createCheckoutSession,
    tierForPriceId,
    tokenLimitForTier,
    type PaidTier,
    type Tier,
} from "../lib/stripe";

export const billingRouter = Router();

const PAID_TIERS: readonly PaidTier[] = [
    "starter",
    "professional",
    "enterprise",
];

function isPaidTier(value: unknown): value is PaidTier {
    return typeof value === "string"
        && (PAID_TIERS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Checkout — start a Stripe Checkout Session for a paid tier.
// ---------------------------------------------------------------------------

billingRouter.post("/checkout", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const email = (res.locals.userEmail as string | undefined) ?? null;
    const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : {};
    const tier = body.tier;
    if (!isPaidTier(tier)) {
        res.status(400).json({
            detail: "tier must be one of: starter, professional, enterprise",
        });
        return;
    }

    const frontendBase =
        process.env.FRONTEND_URL ?? "http://localhost:3000";
    const returnUrl = `${frontendBase}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendBase}/pricing?canceled=1`;

    try {
        const session = await createCheckoutSession({
            userId,
            email,
            tier,
            returnUrl,
            cancelUrl,
        });
        if (!session.url) {
            res.status(500).json({ detail: "Stripe did not return a URL" });
            return;
        }
        res.json({ url: session.url });
    } catch (err) {
        console.error("[billing/checkout] error", err);
        res.status(500).json({ detail: "Failed to create checkout session" });
    }
});

// ---------------------------------------------------------------------------
// Billing portal — let the customer manage payment method / cancel.
// ---------------------------------------------------------------------------

billingRouter.post("/portal", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const db = createServerSupabase();

    const { data } = await db
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();
    const customerId = (data as { stripe_customer_id?: string | null } | null)
        ?.stripe_customer_id;
    if (!customerId) {
        res.status(409).json({
            detail: "No Stripe customer for this user yet — subscribe first.",
        });
        return;
    }

    const frontendBase =
        process.env.FRONTEND_URL ?? "http://localhost:3000";
    try {
        const session = await createBillingPortalSession({
            stripeCustomerId: customerId,
            returnUrl: `${frontendBase}/account/billing`,
        });
        res.json({ url: session.url });
    } catch (err) {
        console.error("[billing/portal] error", err);
        res.status(500).json({ detail: "Failed to create portal session" });
    }
});

// ---------------------------------------------------------------------------
// Webhook — Stripe → backend.
// ---------------------------------------------------------------------------

billingRouter.post("/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string" || !sig) {
        res.status(400).send("Missing Stripe-Signature header");
        return;
    }

    // `express.raw` leaves req.body as a Buffer; Stripe accepts Buffer | string.
    const rawBody = req.body as Buffer | string;
    let event: Stripe.Event;
    try {
        event = constructWebhookEvent(rawBody, sig);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[billing/webhook] signature verification failed", msg);
        res.status(400).send(`Webhook signature verification failed: ${msg}`);
        return;
    }

    try {
        await handleStripeEvent(event);
        res.json({ received: true });
    } catch (err) {
        console.error("[billing/webhook] handler error", err);
        // 500 tells Stripe to retry — important for transient DB errors.
        res.status(500).json({ detail: "Webhook handler failed" });
    }
});

// ---------------------------------------------------------------------------
// Event dispatch
//
// Handled events:
//   - checkout.session.completed       → upsert subscription row, reset counter
//   - customer.subscription.created    → sync tier/status (also covered by checkout)
//   - customer.subscription.updated    → sync tier/status/cancel flag
//   - customer.subscription.deleted    → mark canceled
//   - invoice.paid                     → reset monthly token counter on renewal
//                                        (gated on billing_reason ∈ subscription_*)
// All others are acknowledged with 200 and ignored.
// ---------------------------------------------------------------------------

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
        case "checkout.session.completed":
            await onCheckoutCompleted(
                event.data.object as Stripe.Checkout.Session,
            );
            return;
        case "customer.subscription.updated":
        case "customer.subscription.created":
            await onSubscriptionUpdated(
                event.data.object as Stripe.Subscription,
            );
            return;
        case "customer.subscription.deleted":
            await onSubscriptionDeleted(
                event.data.object as Stripe.Subscription,
            );
            return;
        case "invoice.paid":
            await onInvoicePaid(event.data.object as Stripe.Invoice);
            return;
        default:
            // Acknowledge but ignore — Stripe sends a wide event firehose.
            return;
    }
}

function extractUserId(
    obj: { metadata?: Stripe.Metadata | null; client_reference_id?: string | null },
): string | null {
    const meta = obj.metadata ?? {};
    if (typeof meta.user_id === "string" && meta.user_id) return meta.user_id;
    if (obj.client_reference_id) return obj.client_reference_id;
    return null;
}

function extractTier(meta: Stripe.Metadata | null | undefined): Tier | null {
    const t = meta?.tier;
    if (
        t === "starter" ||
        t === "professional" ||
        t === "enterprise" ||
        t === "trial"
    ) {
        return t;
    }
    return null;
}

async function onCheckoutCompleted(
    session: Stripe.Checkout.Session,
): Promise<void> {
    const userId = extractUserId({
        metadata: session.metadata,
        client_reference_id: session.client_reference_id,
    });
    if (!userId) {
        console.warn(
            "[billing/webhook] checkout.session.completed without user_id",
            session.id,
        );
        return;
    }
    const customerId =
        typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
    const subscriptionId =
        typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
    const tier = extractTier(session.metadata) ?? "starter";

    const db = createServerSupabase();
    const limit = tokenLimitForTier(tier);
    await db.from("subscriptions").upsert(
        {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            tier,
            status: "active",
            monthly_token_limit: limit,
            // Reset token counter at the start of a new paid subscription.
            tokens_used_this_period: 0,
            period_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );
}

async function onSubscriptionUpdated(
    sub: Stripe.Subscription,
): Promise<void> {
    const userId = extractUserId({ metadata: sub.metadata });
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const tierFromPrice = priceId ? tierForPriceId(priceId) : null;
    const tierFromMeta = extractTier(sub.metadata);
    const tier: Tier | null = tierFromPrice ?? tierFromMeta;

    const update: Record<string, unknown> = {
        status: sub.status,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        current_period_end: subscriptionPeriodEnd(sub),
        updated_at: new Date().toISOString(),
    };
    if (tier) {
        update.tier = tier;
        update.monthly_token_limit = tokenLimitForTier(tier);
    }

    const db = createServerSupabase();
    // Prefer matching by subscription ID — most reliable. Fall back to
    // customer ID, then user ID from metadata.
    if (sub.id) {
        const { data } = await db
            .from("subscriptions")
            .update(update)
            .eq("stripe_subscription_id", sub.id)
            .select("id")
            .maybeSingle();
        if (data) return;
    }

    const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
        const { data } = await db
            .from("subscriptions")
            .update({
                ...update,
                stripe_subscription_id: sub.id,
            })
            .eq("stripe_customer_id", customerId)
            .select("id")
            .maybeSingle();
        if (data) return;
    }

    if (userId) {
        await db
            .from("subscriptions")
            .update({
                ...update,
                stripe_subscription_id: sub.id,
                stripe_customer_id:
                    typeof sub.customer === "string"
                        ? sub.customer
                        : sub.customer?.id ?? null,
            })
            .eq("user_id", userId);
    }
}

async function onSubscriptionDeleted(
    sub: Stripe.Subscription,
): Promise<void> {
    const db = createServerSupabase();
    const update = {
        status: "canceled" as const,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        current_period_end: subscriptionPeriodEnd(sub),
        updated_at: new Date().toISOString(),
    };
    if (sub.id) {
        const { data } = await db
            .from("subscriptions")
            .update(update)
            .eq("stripe_subscription_id", sub.id)
            .select("id")
            .maybeSingle();
        if (data) return;
    }
    const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
        await db
            .from("subscriptions")
            .update(update)
            .eq("stripe_customer_id", customerId);
    }
}

/**
 * Handle `invoice.paid` — fired when Stripe successfully collects payment on
 * an invoice. For *subscription* invoices this is our renewal signal, and
 * we use it to reset the monthly token-usage counter.
 *
 * Stripe documents `invoice.billing_reason` as one of:
 *   subscription_create | subscription_cycle | subscription_update |
 *   subscription_threshold | subscription | manual | upcoming | quote_accept |
 *   automatic_pending_invoice_item_invoice
 *
 * The renewal-style reasons that should zero the counter are
 * `subscription_cycle` (recurring renewal — the canonical monthly trigger)
 * and `subscription_create` (the very first invoice on a brand new
 * subscription). Other reasons — especially `manual` (one-off invoices) and
 * `subscription_update` (proration mid-cycle) — must NOT reset the counter,
 * otherwise mid-cycle plan changes or one-off charges would silently grant
 * the user a fresh budget.
 *
 * Idempotent: if no subscription row matches the Stripe subscription id,
 * we log and return without erroring (mirrors `onSubscriptionUpdated`).
 */
async function onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const reason = invoice.billing_reason;
    if (reason !== "subscription_cycle" && reason !== "subscription_create") {
        // One-off invoice, mid-cycle proration, etc. — not a renewal.
        return;
    }

    // `invoice.subscription` was top-level on older API versions and moved
    // to `invoice.parent.subscription_details.subscription` on newer ones.
    // Read both, in priority order, to tolerate SDK/API drift.
    const subId = extractInvoiceSubscriptionId(invoice);
    if (!subId) {
        console.warn(
            "[billing/webhook] invoice.paid without subscription id",
            invoice.id,
        );
        return;
    }

    // Prefer Stripe's authoritative period_start (unix seconds) over wall
    // clock — keeps our reset aligned with Stripe's billing cycle.
    const periodStart =
        typeof invoice.period_start === "number" && invoice.period_start > 0
            ? new Date(invoice.period_start * 1000).toISOString()
            : new Date().toISOString();

    const db = createServerSupabase();
    const { data } = await db
        .from("subscriptions")
        .update({
            tokens_used_this_period: 0,
            period_started_at: periodStart,
            // Defensive: a paid invoice means the subscription is current.
            status: "active",
            updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subId)
        .select("id")
        .maybeSingle();

    if (!data) {
        console.warn(
            "[billing/webhook] invoice.paid for unknown subscription id",
            subId,
        );
    }
}

function extractInvoiceSubscriptionId(
    invoice: Stripe.Invoice,
): string | null {
    // Older API: `invoice.subscription` (string | Subscription | null).
    const top = (invoice as unknown as {
        subscription?: string | { id?: string } | null;
    }).subscription;
    if (typeof top === "string" && top) return top;
    if (top && typeof top === "object" && typeof top.id === "string") {
        return top.id;
    }
    // Newer API: `invoice.parent.subscription_details.subscription`.
    const parent = (invoice as unknown as {
        parent?: {
            subscription_details?: { subscription?: string | null } | null;
        } | null;
    }).parent;
    const nested = parent?.subscription_details?.subscription;
    if (typeof nested === "string" && nested) return nested;
    return null;
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
    // `current_period_end` was promoted from top-level to per-item in recent
    // Stripe API versions. Read both, in priority order, and tolerate the
    // SDK type drift so we work across pinned API versions.
    const top = (sub as unknown as { current_period_end?: number | null })
        .current_period_end;
    if (typeof top === "number" && top > 0) {
        return new Date(top * 1000).toISOString();
    }
    const itemEnd = sub.items?.data?.[0] as
        | (Stripe.SubscriptionItem & { current_period_end?: number | null })
        | undefined;
    if (itemEnd && typeof itemEnd.current_period_end === "number") {
        return new Date(itemEnd.current_period_end * 1000).toISOString();
    }
    return null;
}
