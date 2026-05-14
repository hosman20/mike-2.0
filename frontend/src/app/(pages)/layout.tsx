"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isDevAuthBypass } from "@/lib/devAuth";
import { ChatHistoryProvider } from "@/app/contexts/ChatHistoryContext";
import { SidebarContext } from "@/app/contexts/SidebarContext";
import { IconRail } from "@/components/chrome/icon-rail";
import { SecondaryNav } from "@/components/chrome/secondary-nav";
import { TrialBanner } from "@/components/chrome/trial-banner";
import { DevBanner } from "@/components/chrome/dev-banner";

// Mike 2.1 authenticated shell.
//
// Layout chrome composes two fixed-width columns on desktop:
//   [ IconRail 64w ][ SecondaryNav 224w ][ Main fills, bg-canvas ]
//
// Both nav columns use the bespoke `sidebar` token (white in Mike 2.1)
// with hairline right borders. The chrome auth guard logic from the
// previous AppSidebar layout is preserved — unauthenticated users are
// redirected to /login.
export default function MikeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Dev-only bypass: skip the auth guard entirely. The guard is GATED,
        // not removed — when `isDevAuthBypass` is false (always in prod) the
        // original redirect-to-/login behaviour runs unchanged.
        if (isDevAuthBypass) return;
        if (!authLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <ChatHistoryProvider>
            {/* SidebarContext is preserved for downstream consumers that
                still call setSidebarOpen on legacy modals / pickers. The
                Mike 2.1 chrome itself does not collapse — the rail and
                secondary nav are always-on for desktop. */}
            <SidebarContext.Provider
                value={{ setSidebarOpen: (_open: boolean) => undefined }}
            >
                <div className="h-dvh bg-bg-canvas flex">
                    <IconRail />
                    <SecondaryNav />
                    <main className="flex-1 min-w-0 h-dvh overflow-y-auto bg-bg-canvas flex flex-col">
                        <DevBanner />
                        <TrialBanner />
                        <div className="flex-1 min-h-0">{children}</div>
                    </main>
                </div>
            </SidebarContext.Provider>
        </ChatHistoryProvider>
    );
}
