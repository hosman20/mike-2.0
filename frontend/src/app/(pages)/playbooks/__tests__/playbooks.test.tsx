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
    usePathname: () => "/playbooks",
}));

import PlaybooksPage from "@/app/(pages)/playbooks/page";

describe("Playbooks page (stub)", () => {
    it("renders the Playbooks heading", () => {
        render(<PlaybooksPage />);
        expect(
            screen.getByRole("heading", { name: /^playbooks$/i }),
        ).toBeInTheDocument();
    });

    it("renders the empty state and a Create playbook CTA", () => {
        render(<PlaybooksPage />);
        expect(
            screen.getByRole("heading", { name: /no playbooks yet/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /create playbook/i }),
        ).toBeInTheDocument();
    });
});
