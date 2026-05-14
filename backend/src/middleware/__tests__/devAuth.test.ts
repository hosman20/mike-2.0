import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

function makeRes(): {
    res: Response;
    statusMock: ReturnType<typeof vi.fn>;
    jsonMock: ReturnType<typeof vi.fn>;
} {
    const jsonMock = vi.fn();
    const statusMock = vi.fn(() => ({ json: jsonMock }));
    const res = {
        locals: { userId: "user-1" },
        status: statusMock,
    } as unknown as Response;
    return { res, statusMock, jsonMock };
}

const makeReq = () => ({}) as Request;

/**
 * The middleware reads `isDevAuthBypass` from `lib/devAuth.ts`, which is
 * evaluated at module-load time. Tests must re-import the middleware AFTER
 * stubbing env vars so the snapshot is recomputed.
 */
async function importMiddleware() {
    vi.resetModules();
    const mod = await import("../requireActiveSubscription");
    return mod;
}

describe("DEV_AUTH_BYPASS — requireActiveSubscription", () => {
    let next: NextFunction;

    beforeEach(() => {
        next = vi.fn();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    test("DEV_AUTH_BYPASS=1 + NODE_ENV=development → next() without DB hit", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("DEV_AUTH_BYPASS", "1");

        const { createRequireActiveSubscription } = await importMiddleware();
        const lookup = vi.fn();
        const mw = createRequireActiveSubscription(lookup);
        const { res, statusMock } = makeRes();

        await mw(makeReq(), res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(lookup).not.toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
    });

    test("DEV_AUTH_BYPASS=1 + NODE_ENV=production → bypass IGNORED, real check runs", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DEV_AUTH_BYPASS", "1");

        const { createRequireActiveSubscription } = await importMiddleware();
        const lookup = vi.fn(async () => null); // no subscription row
        const mw = createRequireActiveSubscription(lookup);
        const { res, statusMock, jsonMock } = makeRes();

        await mw(makeReq(), res, next);

        // Real path: lookup is called, no subscription → 402.
        expect(lookup).toHaveBeenCalledOnce();
        expect(next).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "no_subscription" }),
        );
    });

    test("DEV_AUTH_BYPASS unset + NODE_ENV=development → real check runs", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("DEV_AUTH_BYPASS", "");

        const { createRequireActiveSubscription } = await importMiddleware();
        const lookup = vi.fn(async () => null);
        const mw = createRequireActiveSubscription(lookup);
        const { res, statusMock } = makeRes();

        await mw(makeReq(), res, next);

        expect(lookup).toHaveBeenCalledOnce();
        expect(statusMock).toHaveBeenCalledWith(402);
    });
});
