"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
import { SidebarChatItem } from "@/app/components/shared/SidebarChatItem";
import { listProjects } from "@/app/lib/mikeApi";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/chrome/icon-rail";

// Mike 2.1 chrome — secondary nav column.
//
// Design source: Pencil `rmsXd` (ThreadsCol, 220px) from the AI Chat
// screen `CzlFI`. We normalize to 224px (`w-56`) per the design-tokens
// recommendation. White surface, hairline right border, vertical layout
// with a header row, a content area, and an optional spacer/footer.
//
// For the `/assistant` family we render the existing chat history list
// (preserving prior AppSidebar behaviour). For other top-level routes
// we render a simple section title + placeholder body.
function getSectionLabel(pathname: string) {
    const match = NAV_ITEMS.find(
        (item) =>
            pathname === item.href || pathname.startsWith(item.href + "/")
    );
    return match?.label ?? "Workspace";
}

function AssistantHistory() {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuth();
    const { chats, currentChatId, setCurrentChatId } = useChatHistoryContext();
    const [collapsed, setCollapsed] = useState(false);
    const [projectNames, setProjectNames] = useState<Record<string, string>>(
        {}
    );

    useEffect(() => {
        if (!user) return;
        listProjects()
            .then((projects) => {
                const map: Record<string, string> = {};
                for (const p of projects) map[p.id] = p.name;
                setProjectNames(map);
            })
            .catch(() => {});
    }, [user]);

    // Mirror legacy AppSidebar behaviour — derive the active chat id
    // from the URL so the highlight survives a hard refresh.
    useEffect(() => {
        if (pathname.startsWith("/assistant/chat/")) {
            setCurrentChatId(pathname.split("/").pop() ?? null);
            return;
        }
        const projectChatMatch = pathname.match(
            /^\/projects\/[^/]+\/assistant\/chat\/([^/]+)/
        );
        if (projectChatMatch) {
            setCurrentChatId(projectChatMatch[1]);
            return;
        }
        if (pathname === "/assistant") {
            setCurrentChatId(null);
        }
    }, [pathname, setCurrentChatId]);

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="mb-2 px-4 flex items-center justify-between text-[11px] font-semibold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
                <span>History</span>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        collapsed && "-rotate-90"
                    )}
                />
            </button>
            <div
                className={cn(
                    "overflow-y-auto flex-1",
                    collapsed && "hidden"
                )}
            >
                {!chats ? (
                    <div className="space-y-1 px-2">
                        {[40, 60, 50, 70, 45].map((w, i) => (
                            <div
                                key={i}
                                className="h-9 flex items-center px-3 rounded-md"
                            >
                                <div
                                    className="h-3 bg-surface-2 rounded animate-pulse"
                                    style={{ width: `${w}%` }}
                                />
                            </div>
                        ))}
                    </div>
                ) : chats.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2 px-4">
                        No chats yet
                    </div>
                ) : (
                    <div className="space-y-0.5 px-2">
                        {chats.map((chat) => (
                            <SidebarChatItem
                                key={chat.id}
                                chat={chat}
                                isActive={currentChatId === chat.id}
                                projectName={
                                    chat.project_id
                                        ? projectNames[chat.project_id]
                                        : undefined
                                }
                                onSelect={() => {
                                    setCurrentChatId(chat.id);
                                    router.push(
                                        chat.project_id
                                            ? `/projects/${chat.project_id}/assistant/chat/${chat.id}`
                                            : `/assistant/chat/${chat.id}`
                                    );
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function SecondaryNav() {
    const pathname = usePathname();
    const sectionLabel = getSectionLabel(pathname);
    const isAssistant = pathname.startsWith("/assistant");

    return (
        <aside
            aria-label={sectionLabel}
            className="hidden md:flex w-56 h-dvh flex-col bg-sidebar border-r border-border"
        >
            <header className="px-4 pt-4 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                    {sectionLabel}
                </h2>
            </header>

            {isAssistant ? (
                <AssistantHistory />
            ) : (
                <div className="flex-1 min-h-0 px-2 text-sm text-muted-foreground">
                    <p className="px-2 py-1.5 text-xs">
                        No sections yet
                    </p>
                </div>
            )}
        </aside>
    );
}
