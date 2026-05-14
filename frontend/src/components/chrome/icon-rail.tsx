"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
    MessageSquare,
    FolderOpen,
    Table2,
    Workflow,
    BookOpen,
    User as UserIcon,
    type LucideIcon,
} from "lucide-react";
import { MikeIcon } from "@/components/chat/mike-icon";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mike 2.1 chrome — icon rail.
//
// Design source: Pencil frames `x72bX` (chrome/icon-rail) and `wF9tL`
// (chrome/icon-rail-item). The production AI Chat screen (`CzlFI`)
// composes a 64px rail with a near-black logo tile at top, a vertical
// stack of 14px icon buttons (`--text-secondary` ink, `--surface-2`
// hover/active), a flex spacer, then a 24-26px round avatar at the
// bottom. We pick the canonical `64` width from the design tokens doc.
export const NAV_ITEMS: ReadonlyArray<{
    href: string;
    label: string;
    icon: LucideIcon;
}> = [
    { href: "/assistant", label: "Assistant", icon: MessageSquare },
    { href: "/projects", label: "Projects", icon: FolderOpen },
    { href: "/tabular-reviews", label: "Tabular Reviews", icon: Table2 },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/playbooks", label: "Playbooks", icon: BookOpen },
];

function isActiveRoute(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(href + "/");
}

export function IconRail() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { profile } = useUserProfile();

    const initial =
        (profile?.displayName || user?.email || "")
            .trim()
            .charAt(0)
            .toUpperCase() || "U";

    return (
        <nav
            aria-label="Primary"
            className="hidden md:flex w-16 h-dvh flex-col items-center bg-sidebar border-r border-border py-3"
        >
            {/* Logo */}
            <Link
                href="/assistant"
                aria-label="Mike home"
                className="mb-2 flex items-center justify-center"
            >
                <MikeIcon size={22} />
            </Link>

            {/* Nav icons */}
            <ul className="flex flex-col items-center gap-1 mt-2">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const active = isActiveRoute(pathname, href);
                    return (
                        <li key={href}>
                            <button
                                type="button"
                                onClick={() => router.push(href)}
                                title={label}
                                aria-label={label}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "flex items-center justify-center h-9 w-9 rounded-md transition-colors",
                                    active
                                        ? "bg-accent-soft text-accent"
                                        : "text-muted-foreground hover:bg-surface-hover"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        </li>
                    );
                })}
            </ul>

            {/* Spacer */}
            <div className="flex-1" />

            {/* User menu */}
            {user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            title={user.email}
                            aria-label="Account menu"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white"
                        >
                            {initial}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end">
                        <DropdownMenuItem
                            onSelect={() => router.push("/account")}
                        >
                            <UserIcon className="h-4 w-4" />
                            Account Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                                void signOut();
                            }}
                        >
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
        </nav>
    );
}
