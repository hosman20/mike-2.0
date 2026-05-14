// Dev-only auth + paywall bypass.
//
// Hard-gated by `NODE_ENV !== 'production'`. Even if `DEV_AUTH_BYPASS=1`
// leaks into a production deploy, the flag is ignored — `isDevAuthBypass`
// can only be `true` outside production. Do NOT remove the NODE_ENV check.

export const isDevAuthBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1";

// Must match the stub UUID used by the frontend (`frontend/src/lib/devAuth.ts`)
// so that anything keyed off the user id (subscriptions row, R2 prefixes,
// etc.) lines up across the two processes.
export const DEV_STUB_USER_ID = "00000000-0000-0000-0000-000000000dev";
export const DEV_STUB_USER_EMAIL = "dev@mike.local";
