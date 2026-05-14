"use client";

// Mike 2.1 — Trial / quota banner.
//
// Sticky thin banner rendered at the top of the main authenticated area
// (above the children of `(pages)/layout.tsx`). Shows:
//   - "Trial ends in N days · Upgrade" when status === "trialing"
//   - "X% of monthly tokens used · Upgrade" when active and >80% used
//   - Nothing otherwise.
//
// Tone tokens:
//   - bg-amber-soft for trial / <95% warning
//   - bg-rose-soft for >95% used

import Link from "next/link";
import { useUserProfile } from "@/contexts/UserProfileContext";

function daysUntil(iso: string | null): number | null {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function TrialBanner() {
    const { profile } = useUserProfile();
    const sub = profile?.subscription;
    if (!sub) return null;

    if (sub.status === "trialing") {
        const days = daysUntil(sub.trial_ends_at);
        const label =
            days === null
                ? "Trial active"
                : days === 0
                  ? "Trial ends today"
                  : days === 1
                    ? "Trial ends in 1 day"
                    : `Trial ends in ${days} days`;
        return (
            <div
                role="status"
                className="w-full bg-amber-soft border-b border-amber text-amber px-4 py-2 text-xs flex items-center justify-center gap-3"
            >
                <span>{label}</span>
                <span aria-hidden="true">·</span>
                <Link
                    href="/pricing"
                    className="font-medium underline-offset-2 hover:underline"
                >
                    Upgrade
                </Link>
            </div>
        );
    }

    if (sub.status === "active" && sub.monthly_token_limit > 0) {
        const ratio =
            sub.tokens_used_this_period / sub.monthly_token_limit;
        if (ratio > 0.8) {
            const pct = Math.min(100, Math.round(ratio * 100));
            const isCritical = ratio > 0.95;
            const tone = isCritical
                ? "bg-rose-soft border-b border-rose text-rose"
                : "bg-amber-soft border-b border-amber text-amber";
            return (
                <div
                    role="status"
                    className={`w-full ${tone} px-4 py-2 text-xs flex items-center justify-center gap-3`}
                >
                    <span>{pct}% of monthly tokens used</span>
                    <span aria-hidden="true">·</span>
                    <Link
                        href="/pricing"
                        className="font-medium underline-offset-2 hover:underline"
                    >
                        Upgrade
                    </Link>
                </div>
            );
        }
    }

    return null;
}
