import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// ChatInput previously rendered an <ApiKeyMissingModal> portal whenever the
// selected model didn't match a configured user API key. After the AI Gateway
// migration, per-user API keys + `apiKeyStatus` were removed from the backend.
// This test guards against the dead modal coming back.

vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: vi.fn() } },
            }),
        },
    }),
}));

vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { id: "u1", email: "test@example.com" },
        isAuthenticated: true,
        authLoading: false,
        signOut: vi.fn(),
    }),
}));

vi.mock("@/app/hooks/useSelectedModel", () => ({
    useSelectedModel: () => ["gemini-3-flash-preview", vi.fn()],
}));

import { ChatInput } from "../ChatInput";

describe("ChatInput — API key modal removal", () => {
    it("renders without an ApiKeyMissingModal portal in the DOM", () => {
        render(
            <ChatInput
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
                isLoading={false}
            />,
        );

        // The modal heading was "API key required". If the modal mounts a
        // portal, it would attach a node to document.body. We assert the
        // heading text never appears anywhere in the document.
        expect(document.body.textContent ?? "").not.toContain(
            "API key required",
        );
    });
});
