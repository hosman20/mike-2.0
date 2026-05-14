import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// next/navigation — chrome reads usePathname() and useRouter() during render.
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => "/assistant",
}));

// Auth context — IconRail uses user + signOut; SecondaryNav reads user
// to gate the chat-history fetch.
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { id: "u1", email: "lawyer@example.com" },
        isAuthenticated: true,
        authLoading: false,
        signOut: vi.fn(),
    }),
}));

vi.mock("@/contexts/UserProfileContext", () => ({
    useUserProfile: () => ({
        profile: { displayName: "Test Lawyer", tier: "Pro" },
    }),
}));

// Chat history context — SecondaryNav consumes chats/currentChatId.
vi.mock("@/app/contexts/ChatHistoryContext", () => ({
    useChatHistoryContext: () => ({
        chats: [],
        currentChatId: null,
        setCurrentChatId: vi.fn(),
    }),
}));

// mikeApi — listProjects is called in an effect when there is a user.
vi.mock("@/app/lib/mikeApi", () => ({
    listProjects: vi.fn(async () => []),
}));

import { IconRail } from "@/components/chrome/icon-rail";
import { SecondaryNav } from "@/components/chrome/secondary-nav";

describe("Mike 2.1 chrome smoke test", () => {
    it("IconRail renders the primary nav buttons", () => {
        render(<IconRail />);
        // Each NAV_ITEM produces a button labeled by its `label`.
        expect(
            screen.getByRole("button", { name: /assistant/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /projects/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /playbooks/i })
        ).toBeInTheDocument();
    });

    it("SecondaryNav renders the section title for /assistant", () => {
        render(<SecondaryNav />);
        // Header reflects the active section. Use a heading query to
        // sidestep the matching button labels inside the IconRail (which
        // is not rendered in this test).
        expect(
            screen.getByRole("heading", { name: /assistant/i })
        ).toBeInTheDocument();
    });
});
