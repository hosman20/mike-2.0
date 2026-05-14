/**
 * Billing client helpers.
 *
 * Both functions hit the backend authenticated (Supabase session token) and
 * redirect the browser to Stripe-hosted pages. They throw on transport
 * failure so callers can surface a toast — they do NOT swallow errors.
 */

import { supabase } from "@/lib/supabase";

export type PaidTier = "starter" | "professional" | "enterprise";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function postBilling<T>(path: string, body?: unknown): Promise<T> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error("You must be signed in to manage billing.");
    }
    const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Billing request failed: ${response.status}`);
    }
    return (await response.json()) as T;
}

/**
 * Start a Stripe Checkout Session for the chosen paid tier and redirect.
 * Server returns `{ url }` — we hand the browser off to Stripe.
 */
export async function redirectToCheckout(tier: PaidTier): Promise<void> {
    const { url } = await postBilling<{ url: string }>(
        "/api/billing/checkout",
        { tier },
    );
    window.location.href = url;
}

/**
 * Open the Stripe billing portal so the customer can manage their plan /
 * payment method / cancel.
 */
export async function redirectToBillingPortal(): Promise<void> {
    const { url } = await postBilling<{ url: string }>(
        "/api/billing/portal",
    );
    window.location.href = url;
}
