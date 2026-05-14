import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * `isDevAuthBypass` is evaluated at module-load time. Each case must
 * stub env vars BEFORE importing the module, then reset the module
 * cache afterwards so the next test starts from a clean slate.
 */
async function importDevAuth() {
    vi.resetModules();
    const mod = await import("../devAuth");
    return mod;
}

describe("isDevAuthBypass", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    test("NEXT_PUBLIC_DEV_AUTH_BYPASS=1 + NODE_ENV=development → true", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "1");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(true);
    });

    test("NEXT_PUBLIC_DEV_AUTH_BYPASS=1 + NODE_ENV=production → false", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "1");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(false);
    });

    test("NEXT_PUBLIC_DEV_AUTH_BYPASS=1 + NODE_ENV=test → true", async () => {
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "1");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(true);
    });

    test("empty string → false", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(false);
    });

    test("\"0\" → false (only \"1\" is on)", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "0");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(false);
    });

    test("\"true\" → false (only \"1\" is on)", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "true");

        const { isDevAuthBypass } = await importDevAuth();
        expect(isDevAuthBypass).toBe(false);
    });
});
