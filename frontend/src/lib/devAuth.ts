// Dev-only auth + paywall bypass.
//
// Hard-gated by `NODE_ENV !== 'production'`. Even if
// `NEXT_PUBLIC_DEV_AUTH_BYPASS=1` leaks into a production build, the flag
// is ignored — `isDevAuthBypass` can only be `true` outside production.
// Do NOT remove the NODE_ENV check.

import type {
    SubscriptionInfo,
    UserProfile,
} from "@/app/lib/mikeApi";

export const isDevAuthBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

// Must match the stub UUID used by the backend (`backend/src/lib/devAuth.ts`).
export const DEV_STUB_USER = {
    id: "00000000-0000-0000-0000-000000000dev",
    email: "dev@mike.local",
    user_metadata: {
        full_name: "Dev User",
        organisation: "Mike Dev Firm",
    },
} as const;

// 30 days from "now" — recomputed at module-load time, which is fine for
// dev preview purposes. If the dev server runs for >30 days the banner
// will still render; it won't accidentally expire mid-session.
const DEV_PERIOD_END_ISO = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
).toISOString();

const DEV_SUBSCRIPTION: SubscriptionInfo = {
    tier: "professional",
    status: "active",
    trial_ends_at: null,
    current_period_end: DEV_PERIOD_END_ISO,
    tokens_used_this_period: 0,
    monthly_token_limit: 35_000_000,
};

export const DEV_STUB_PROFILE: UserProfile = {
    displayName: DEV_STUB_USER.user_metadata.full_name,
    organisation: DEV_STUB_USER.user_metadata.organisation,
    messageCreditsUsed: 0,
    creditsResetDate: DEV_PERIOD_END_ISO,
    creditsRemaining: 999_999,
    tier: "professional",
    tabularModel: "gemini-3-flash-preview",
    apiKeyStatus: {
        claude: false,
        gemini: false,
        openai: false,
        sources: {
            claude: null,
            gemini: null,
            openai: null,
        },
    },
    subscription: DEV_SUBSCRIPTION,
};
