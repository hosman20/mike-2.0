import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: vi.fn(),
        push: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => "/account/billing",
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getSession: vi.fn(async () => ({ data: { session: null } })),
        },
    },
}));

vi.mock("@/lib/billing", () => ({
    redirectToBillingPortal: vi.fn(async () => undefined),
}));

vi.mock("@/contexts/UserProfileContext", () => ({
    useUserProfile: () => ({
        profile: {
            displayName: null,
            organisation: null,
            messageCreditsUsed: 0,
            creditsResetDate: new Date().toISOString(),
            creditsRemaining: 999999,
            tier: "Free",
            tabularModel: "gemini-3-flash-preview",
            subscription: {
                tier: "trial",
                status: "trialing",
                trial_ends_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                current_period_end: null,
                tokens_used_this_period: 250_000,
                monthly_token_limit: 1_000_000,
            },
        },
        loading: false,
    }),
}));

import BillingPage from "@/app/(pages)/account/billing/page";

describe("Billing settings page", () => {
    it("renders the token usage progress bar", () => {
        render(<BillingPage />);
        const bar = screen.getByRole("progressbar", {
            name: /monthly token usage/i,
        });
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveAttribute("aria-valuenow", "25");
    });

    it('"View plans" link points to /pricing', () => {
        render(<BillingPage />);
        const link = screen.getByRole("link", { name: /view plans/i });
        expect(link).toHaveAttribute("href", "/pricing");
    });
});
