// Bearer JWT auth for Next.js API route handlers.
//
// Mirrors `backend/src/middleware/auth.ts`. Returns either a typed
// `AuthedSession` on success or a `NextResponse(401)` on failure so
// callers can do:
//
//     const s = await requireAuth(req);
//     if (s instanceof NextResponse) return s;
//     // s is AuthedSession here
//
// Honors the SERVER-SIDE dev bypass via `DEV_AUTH_BYPASS=1` — gated by
// `NODE_ENV !== 'production'`. The frontend `NEXT_PUBLIC_DEV_AUTH_BYPASS`
// flag is intentionally NOT used here: API routes run on the server, and
// keeping the server flag separate prevents a leaked NEXT_PUBLIC_* value
// from re-enabling the bypass on a deployed Next.js server.

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "./supabase";

export type AuthedSession = {
    userId: string;
    userEmail: string | null;
    token: string;
};

const DEV_STUB_USER_ID = "00000000-0000-0000-0000-000000000dev";
const DEV_STUB_USER_EMAIL = "dev@mike.local";

function isDevAuthBypass(): boolean {
    return (
        process.env.NODE_ENV !== "production" &&
        process.env.DEV_AUTH_BYPASS === "1"
    );
}

export async function requireAuth(
    req: NextRequest,
): Promise<AuthedSession | NextResponse> {
    if (isDevAuthBypass()) {
        return {
            userId: DEV_STUB_USER_ID,
            userEmail: DEV_STUB_USER_EMAIL,
            token: "dev",
        };
    }

    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
        return NextResponse.json(
            { detail: "Missing or invalid Authorization header" },
            { status: 401 },
        );
    }
    const token = auth.slice(7).trim();

    let admin;
    try {
        admin = createServerSupabase();
    } catch {
        return NextResponse.json(
            { detail: "Server auth is not configured" },
            { status: 500 },
        );
    }

    const { data } = await admin.auth.getUser(token);
    if (!data.user) {
        return NextResponse.json(
            { detail: "Invalid or expired token" },
            { status: 401 },
        );
    }

    return {
        userId: data.user.id,
        userEmail: data.user.email?.toLowerCase() ?? null,
        token,
    };
}
