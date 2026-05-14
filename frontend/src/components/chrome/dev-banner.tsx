"use client";

// Dev-only banner — renders when the frontend bypass flag is on.
//
// Hard-gated by NODE_ENV !== 'production' inside `isDevAuthBypass`. The
// component returns null in any production build even if someone leaves
// `NEXT_PUBLIC_DEV_AUTH_BYPASS=1` in the environment.

import { isDevAuthBypass } from "@/lib/devAuth";

export function DevBanner() {
    if (!isDevAuthBypass) return null;
    return (
        <div
            role="status"
            className="w-full bg-amber-soft border-b border-amber text-amber px-4 py-2 text-xs flex items-center justify-center gap-2"
        >
            <span aria-hidden="true">🔓</span>
            <span>
                Dev mode — auth + paywall bypassed. Production builds ignore
                this.
            </span>
        </div>
    );
}
