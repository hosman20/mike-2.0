import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation — pages call useRouter()/router.replace()/router.push()
// during render and inside the auth redirect effect.
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: vi.fn(),
        push: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
}));

// Mock the supabase client. The pages only touch auth.signInWithPassword
// and auth.signUp from the module exposed at @/lib/supabase.
vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
            signUp: vi.fn(async () => ({
                data: { session: null },
                error: null,
            })),
            getSession: vi.fn(async () => ({ data: { session: null } })),
            onAuthStateChange: vi.fn(() => ({
                data: { subscription: { unsubscribe: vi.fn() } },
            })),
            signOut: vi.fn(async () => ({})),
        },
    },
}));

// Stub the profile API used after signup so tests stay isolated from network.
vi.mock("@/app/lib/mikeApi", () => ({
    updateUserProfile: vi.fn(async () => ({})),
}));

// Stub the auth context so the pages render without an AuthProvider wrapper.
// They only consume `isAuthenticated` + `authLoading` from `useAuth()`.
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        isAuthenticated: false,
        authLoading: false,
        signOut: vi.fn(),
    }),
}));

import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";

describe("Mike 2.1 auth pages smoke test", () => {
    it("login page renders email + password inputs and submit button", () => {
        render(<LoginPage />);

        expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /sign in/i }),
        ).toBeInTheDocument();
    });

    it("signup page renders email, password, name, and organisation inputs", () => {
        render(<SignupPage />);

        // Organisation is the firm name (B2B requirement).
        expect(screen.getByLabelText(/firm name/i)).toBeInTheDocument();
        // Optional full name field.
        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /start free trial/i }),
        ).toBeInTheDocument();
    });
});
