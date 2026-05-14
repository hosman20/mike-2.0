"use client";

// Mike 2.1 — Playbooks (stub).
//
// The IconRail (`frontend/src/components/chrome/icon-rail.tsx`) ships
// with a Playbooks nav entry, but the actual playbook system is parked
// for Phase 2. This page renders a Mike 2.1-styled empty state so the
// route resolves and the nav target stops 404'ing.
//
// Pattern mirrors `(pages)/projects/page.tsx`: page header with title +
// trailing CTA, a tabbed toolbar via `ToolbarTabs`, and an empty state
// inside the table chrome. No new shadcn primitives.

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolbarTabs } from "@/app/components/shared/ToolbarTabs";

type Tab = "all" | "mine" | "templates";

const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "Mine" },
    { id: "templates", label: "Templates" },
];

export default function PlaybooksPage() {
    const [activeTab, setActiveTab] = useState<Tab>("all");

    return (
        <div className="flex-1 overflow-y-auto bg-bg-canvas">
            {/* Page header */}
            <div className="flex items-center justify-between px-8 py-4">
                <div>
                    <h1 className="text-2xl font-medium font-serif text-foreground">
                        Playbooks
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                        Firm-specific review rules with severity flags and
                        citations. Apply automatically to new documents.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" disabled>
                        + New playbook
                    </Button>
                </div>
            </div>

            <ToolbarTabs
                tabs={TABS}
                active={activeTab}
                onChange={setActiveTab}
            />

            {/* Empty state */}
            <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
                <BookOpen className="h-8 w-8 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-medium font-serif text-foreground">
                    No playbooks yet
                </h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Create a playbook to standardize how Mike reviews
                    documents for your firm.
                </p>
                <Button type="button" className="mt-4" disabled>
                    + Create playbook
                </Button>
            </div>
        </div>
    );
}
