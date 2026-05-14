import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

describe("Mike 2.1 UI primitives smoke test", () => {
    it("mounts <Button> without throwing", () => {
        render(<Button>Click me</Button>);
        expect(
            screen.getByRole("button", { name: "Click me" })
        ).toBeInTheDocument();
    });

    it("mounts <Input> without throwing", () => {
        render(<Input placeholder="Search" />);
        expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
    });

    it("mounts <Badge> without throwing", () => {
        render(<Badge>New</Badge>);
        expect(screen.getByText("New")).toBeInTheDocument();
    });
});
