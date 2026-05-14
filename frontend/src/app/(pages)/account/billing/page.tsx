"use client";

// Mike 2.1 — Billing settings.
//
// Lives inside the authenticated (pages) group. Reads subscription from
// the UserProfileContext, renders a tier pill + token usage bar + actions.
//
// The "Manage billing" button is disabled if there's no Stripe customer
// (i.e. user is still on trial). If the backend returns 409 from the
// billing portal endpoint, we fall through to the pricing page.

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { redirectToBillingPortal } from "@/lib/billing";
import type {
    SubscriptionStatus,
    SubscriptionTier,
} from "@/app/lib/mikeApi";

const TIER_LABEL: Record<SubscriptionTier, string> = {
    trial: "Trial",
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise",
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
    trialing: "Trialing",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    incomplete_expired: "Incomplete (expired)",
};

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return iso;
    }
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
}

export default function BillingPage() {
    const { profile, loading } = useUserProfile();
    const subscription = profile?.subscription ?? null;

    const [portalLoading, setPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);

    const handlePortal = async () => {
        setPortalError(null);
        setPortalLoading(true);
        try {
            await redirectToBillingPortal();
        } catch (err) {
            setPortalLoading(false);
            const message =
                err instanceof Error ? err.message : String(err);
            // Backend returns 409 with "No Stripe customer …" if user is
            // still on trial. Fall through to pricing.
            if (/no stripe customer/i.test(message) || /409/.test(message)) {
                window.location.href = "/pricing";
                return;
            }
            setPortalError(message);
        }
    };

    const used = subscription?.tokens_used_this_period ?? 0;
    const limit = subscription?.monthly_token_limit ?? 0;
    const usagePct =
        limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    const tierLabel = subscription
        ? TIER_LABEL[subscription.tier] ?? subscription.tier
        : "—";
    const statusLabel = subscription
        ? STATUS_LABEL[subscription.status] ?? subscription.status
        : "—";

    const hasStripeCustomer =
        !!subscription &&
        subscription.tier !== "trial" &&
        subscription.status !== "trialing";

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-medium font-serif mb-4">
                    Billing
                </h2>

                {loading ? (
                    <div className="h-32 animate-pulse rounded-md bg-surface-2" />
                ) : !subscription ? (
                    <div className="rounded-md border border-border bg-white p-6">
                        <p className="text-sm text-muted-foreground">
                            No subscription on file yet.
                        </p>
                        <div className="mt-4">
                            <Button asChild>
                                <Link href="/pricing">View plans</Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-md border border-border bg-white p-6 space-y-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text">
                                {tierLabel}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {statusLabel}
                            </span>
                        </div>

                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                            {subscription.status === "trialing" && (
                                <div>
                                    <dt className="text-muted-foreground">
                                        Trial ends
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                        {formatDate(subscription.trial_ends_at)}
                                    </dd>
                                </div>
                            )}
                            {subscription.current_period_end && (
                                <div>
                                    <dt className="text-muted-foreground">
                                        Next billing date
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                        {formatDate(
                                            subscription.current_period_end,
                                        )}
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <div>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-sm font-medium text-foreground">
                                    Token usage
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatTokens(used)} / {formatTokens(limit)}
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={usagePct}
                                aria-label="Monthly token usage"
                                className="h-2 w-full rounded-full bg-border overflow-hidden"
                            >
                                <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${usagePct}%` }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {usagePct}% used this period
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <span
                                title={
                                    hasStripeCustomer
                                        ? undefined
                                        : "Available after you start a paid plan."
                                }
                            >
                                <Button
                                    type="button"
                                    onClick={handlePortal}
                                    disabled={
                                        !hasStripeCustomer || portalLoading
                                    }
                                >
                                    {portalLoading
                                        ? "Opening…"
                                        : "Manage billing"}
                                </Button>
                            </span>
                            <Button asChild variant="outline">
                                <Link href="/pricing">View plans</Link>
                            </Button>
                        </div>

                        {portalError && (
                            <p
                                className="text-xs text-rose"
                                role="alert"
                            >
                                {portalError}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
