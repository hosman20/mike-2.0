import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// `requireAuth` constructs its own Supabase client at call time. Mock the
// SDK module so the test never hits the network — and so we can inspect /
// inject responses for the invalid-token case.
const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
        auth: { getUser: getUserMock },
    }),
}));

function makeReq(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest("http://localhost/api/test", { headers });
}

describe("requireAuth", () => {
    beforeEach(() => {
        vi.resetModules();
        getUserMock.mockReset();
        // Default env: prod-like, no dev bypass. Each test stubs as needed.
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DEV_AUTH_BYPASS", "");
        vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
        vi.stubEnv("SUPABASE_SECRET_KEY", "service-role-key");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("missing Authorization header → 401", async () => {
        const { requireAuth } = await import("../auth");
        const result = await requireAuth(makeReq());
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(401);
        expect(getUserMock).not.toHaveBeenCalled();
    });

    test("invalid token → 401", async () => {
        getUserMock.mockResolvedValueOnce({
            data: { user: null },
            error: { message: "JWT expired" },
        });
        const { requireAuth } = await import("../auth");
        const result = await requireAuth(
            makeReq({ authorization: "Bearer bogus.token.value" }),
        );
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(401);
        expect(getUserMock).toHaveBeenCalledOnce();
        expect(getUserMock).toHaveBeenCalledWith("bogus.token.value");
    });

    test("DEV_AUTH_BYPASS=1 in non-prod → returns stub session without calling Supabase", async () => {
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DEV_AUTH_BYPASS", "1");
        const { requireAuth } = await import("../auth");
        const result = await requireAuth(makeReq());
        expect(result).not.toBeInstanceOf(NextResponse);
        const session = result as {
            userId: string;
            userEmail: string | null;
            token: string;
        };
        expect(session.userId).toBe("00000000-0000-0000-0000-000000000dev");
        expect(session.userEmail).toBe("dev@mike.local");
        expect(session.token).toBe("dev");
        expect(getUserMock).not.toHaveBeenCalled();
    });
});
