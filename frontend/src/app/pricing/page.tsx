"use client";

// Mike 2.1 — Pricing page.
//
// Publicly accessible. Reached either organically or via the 402 paywall
// interceptor in `mikeApi.ts`, which redirects unauthenticated AND
// authenticated users here with a `?reason=` query param.
//
// Hard constraints:
//   - Must render for logged-out users (it's the destination of 402 redirects).
//   - No new shadcn primitives — raw HTML + Tailwind tokens only.
//   - Marketing copy mirrors the tier definitions in architecture.html.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";
import { redirectToCheckout, type PaidTier } from "@/lib/billing";

type PaywallReason =
    | "trial_expired"
    | "token_limit_reached"
    | "subscription_inactive"
    | "no_subscription"
    | (string & {});

const REASON_COPY: Record<string, string> = {
    trial_expired:
        "Your 14-day trial has ended. Pick a plan to continue using Mike — your documents, chat history, and playbooks are safe.",
    token_limit_reached:
        "You've used this month's token allowance. Upgrade to keep generating, or wait until next period.",
    subscription_inactive:
        "Your subscription isn't active. Update your billing details or pick a new plan to resume.",
    no_subscription:
        "You don't have an active subscription yet. Start a plan to unlock Mike.",
};

interface PlanCard {
    id: PaidTier;
    name: string;
    price: string;
    cadence: string;
    tagline: string;
    features: string[];
    cta: string;
    featured?: boolean;
}

const PLANS: PlanCard[] = [
    {
        id: "starter",
        name: "Starter",
        price: "$99",
        cadence: "/seat/mo",
        tagline: "For boutique firms",
        features: [
            "Up to 10 seats",
            "10M tokens / seat / mo",
            "Tabular Review",
            "3 playbooks",
            "Export to Word / Excel",
        ],
        cta: "Start Starter",
    },
    {
        id: "professional",
        name: "Professional",
        price: "$249",
        cadence: "/seat/mo",
        tagline: "For growing practices",
        features: [
            "Unlimited seats",
            "35M tokens / seat / mo",
            "Unlimited playbooks",
            "Visual workflows",
            "Arabic RTL",
            "Priority models",
        ],
        cta: "Start Professional",
        featured: true,
    },
    {
        id: "enterprise",
        name: "Enterprise",
        price: "$499+",
        cadence: "/seat/mo",
        tagline: "For large firms",
        features: [
            "Everything in Professional",
            "SAML SSO",
            "SCIM provisioning",
            "Data sovereignty",
            "Audit log",
            "SLA",
        ],
        cta: "Contact sales",
    },
];

function ReasonBanner({ reason }: { reason: PaywallReason | null }) {
    if (!reason) return null;
    const copy = REASON_COPY[reason] ?? REASON_COPY.no_subscription;
    return (
        <div
            role="alert"
            className="mx-auto mb-8 max-w-4xl rounded-md border border-amber bg-amber-soft px-4 py-3 text-sm text-amber"
        >
            {copy}
        </div>
    );
}

function PlanCardView({ plan }: { plan: PlanCard }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async () => {
        setError(null);
        setLoading(true);
        try {
            await redirectToCheckout(plan.id);
        } catch (err) {
            setLoading(false);
            const message =
                err instanceof Error
                    ? err.message
                    : "Could not start checkout.";
            // The 402 interceptor in mikeApi only fires for `apiRequest`. The
            // billing helper uses `fetch` directly — a "must be signed in"
            // error is the common case for logged-out visitors.
            if (/signed in/i.test(message)) {
                window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
                return;
            }
            setError(message);
        }
    };

    const isEnterprise = plan.id === "enterprise";
    // All three pricing cards use the universal hairline `border-border`
    // (1px, `#E5E7EB`) — same as the auth cards and the billing settings
    // card. The "Most popular" card is differentiated solely by the
    // floating badge, not a thicker border.
    const cardClass = "relative border border-border rounded-md p-6 bg-white";

    return (
        <div className={cardClass}>
            {plan.featured && (
                <span className="absolute -top-3 right-4 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">
                    Most popular
                </span>
            )}
            <h3 className="text-xl font-medium text-foreground">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium text-foreground">
                    {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                    {plan.cadence}
                </span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-foreground">
                {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                        <span aria-hidden="true" className="text-foreground">
                            •
                        </span>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
            <div className="mt-6">
                {isEnterprise ? (
                    // TEMP: Phase 1 placeholder — `sales@mike.ai` mailbox is
                    // not yet provisioned and this `mailto:` renders as a
                    // broken link on browsers without a mail client. Replace
                    // with a real Calendly/HubSpot form before public launch.
                    // Tracked as deploy-checklist follow-up #4.
                    <Button asChild className="w-full" variant="outline">
                        <a
                            href="mailto:sales@mike.ai?subject=Enterprise inquiry"
                            data-cta="enterprise-mailto"
                        >
                            {plan.cta}
                        </a>
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={handleCheckout}
                        disabled={loading}
                        variant={plan.featured ? "default" : "outline"}
                        className="w-full"
                    >
                        {loading ? "Redirecting…" : plan.cta}
                    </Button>
                )}
            </div>
            {error && (
                <p className="mt-2 text-xs text-rose" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

interface FaqItem {
    q: string;
    a: string;
}

const FAQS: FaqItem[] = [
    {
        q: "What happens when my trial ends?",
        a: "Your account stays — you just can't generate new responses until you upgrade. Existing documents, chat history, and playbooks stay safe.",
    },
    {
        q: "Why is pricing per seat?",
        a: "We bill per active lawyer, not per usage. Tokens are included so your team can use AI freely without watching meters.",
    },
    {
        q: "Can I switch plans later?",
        a: "Yes — upgrade or downgrade anytime from billing settings. Prorated automatically.",
    },
];

function PricingContent() {
    const searchParams = useSearchParams();
    const { isAuthenticated } = useAuth();
    const reason = searchParams.get("reason");

    return (
        <div className="min-h-dvh bg-bg-canvas">
            <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8 pb-12">
                <SiteLogo size="md" asLink />
                {isAuthenticated && (
                    <Link
                        href="/assistant"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Back to app
                    </Link>
                )}
            </header>

            <main className="mx-auto w-full max-w-5xl px-6 pb-16">
                <ReasonBanner reason={reason} />

                <section className="text-center">
                    <h1 className="text-4xl md:text-5xl font-medium font-serif text-foreground">
                        Plans for legal teams
                    </h1>
                    <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                        Pay one transparent subscription. No token costs. No
                        surprises.
                    </p>
                </section>

                <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                    {PLANS.map((plan) => (
                        <PlanCardView key={plan.id} plan={plan} />
                    ))}
                </section>

                <section className="mt-20 max-w-3xl mx-auto">
                    <h2 className="text-2xl font-medium font-serif text-foreground mb-6">
                        Frequently asked questions
                    </h2>
                    <div className="space-y-2">
                        {FAQS.map((faq) => (
                            <details
                                key={faq.q}
                                className="group rounded-md border border-border bg-white px-4 py-3"
                            >
                                <summary className="cursor-pointer list-none text-sm font-medium text-foreground flex items-center justify-between">
                                    <span>{faq.q}</span>
                                    <span
                                        aria-hidden="true"
                                        className="ml-2 text-muted-foreground transition-transform group-open:rotate-45"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {faq.a}
                                </p>
                            </details>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default function PricingPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-dvh bg-bg-canvas flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border border-border border-t-foreground" />
                </div>
            }
        >
            <PricingContent />
        </Suspense>
    );
}
