import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// useSearchParams is read inside a Suspense boundary on the pricing page;
// we mock the whole next/navigation surface used during render.
const searchParamsMock = { get: vi.fn() };

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParamsMock,
    useRouter: () => ({
        replace: vi.fn(),
        push: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        isAuthenticated: false,
        authLoading: false,
        signOut: vi.fn(),
    }),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getSession: vi.fn(async () => ({ data: { session: null } })),
        },
    },
}));

vi.mock("@/lib/billing", () => ({
    redirectToCheckout: vi.fn(async () => undefined),
    redirectToBillingPortal: vi.fn(async () => undefined),
}));

import PricingPage from "@/app/pricing/page";

describe("Pricing page", () => {
    it("renders three plan cards", () => {
        searchParamsMock.get.mockReturnValue(null);
        render(<PricingPage />);

        expect(
            screen.getByRole("heading", {
                name: /plans for legal teams/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /^starter$/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /^professional$/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /^enterprise$/i }),
        ).toBeInTheDocument();
    });

    it("shows a paywall banner when ?reason=trial_expired", () => {
        searchParamsMock.get.mockImplementation((key: string) =>
            key === "reason" ? "trial_expired" : null,
        );
        render(<PricingPage />);
        expect(screen.getByRole("alert")).toHaveTextContent(
            /14-day trial has ended/i,
        );
    });

    it("renders Start Starter and Start Professional CTAs", () => {
        searchParamsMock.get.mockReturnValue(null);
        render(<PricingPage />);
        expect(
            screen.getByRole("button", { name: /start starter/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /start professional/i }),
        ).toBeInTheDocument();
    });
});
