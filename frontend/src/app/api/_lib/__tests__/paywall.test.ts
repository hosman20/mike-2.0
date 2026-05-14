import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextResponse } from "next/server";
import {
    createRequireActiveSubscription,
    type SubscriptionRow,
} from "../paywall";

const inFuture = () => new Date(Date.now() + 60_000).toISOString();
const inPast = () => new Date(Date.now() - 60_000).toISOString();

describe("requireActiveSubscription", () => {
    beforeEach(() => {
        // Force prod-like NODE_ENV for tests so the dev bypass doesn't fire.
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DEV_AUTH_BYPASS", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("no subscription row → 402 with reason no_subscription", async () => {
        const mw = createRequireActiveSubscription(async () => null);
        const result = await mw("user-1");
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body).toMatchObject({
            error: "payment_required",
            reason: "no_subscription",
            upgrade_url: "/pricing",
        });
    });

    test("trialing + trial expired → 402 with reason trial_expired", async () => {
        const row: SubscriptionRow = {
            id: "sub-1",
            tier: "trial",
            status: "trialing",
            trial_ends_at: inPast(),
            current_period_end: null,
            monthly_token_limit: 1_000_000,
            tokens_used_this_period: 0,
        };
        const mw = createRequireActiveSubscription(async () => row);
        const result = await mw("user-1");
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body).toMatchObject({
            error: "payment_required",
            reason: "trial_expired",
            upgrade_url: "/pricing",
        });
    });

    test("status=canceled → 402 with reason subscription_inactive", async () => {
        const row: SubscriptionRow = {
            id: "sub-1",
            tier: "starter",
            status: "canceled",
            trial_ends_at: null,
            current_period_end: inPast(),
            monthly_token_limit: 1_000_000,
            tokens_used_this_period: 0,
        };
        const mw = createRequireActiveSubscription(async () => row);
        const result = await mw("user-1");
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body).toMatchObject({ reason: "subscription_inactive" });
    });

    test("active + at token limit → 402 with reason token_limit_reached", async () => {
        const row: SubscriptionRow = {
            id: "sub-1",
            tier: "starter",
            status: "active",
            trial_ends_at: null,
            current_period_end: inFuture(),
            monthly_token_limit: 1_000_000,
            tokens_used_this_period: 1_000_000,
        };
        const mw = createRequireActiveSubscription(async () => row);
        const result = await mw("user-1");
        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body).toMatchObject({ reason: "token_limit_reached" });
    });

    test("active + under token limit → null (pass)", async () => {
        const row: SubscriptionRow = {
            id: "sub-1",
            tier: "starter",
            status: "active",
            trial_ends_at: null,
            current_period_end: inFuture(),
            monthly_token_limit: 1_000_000,
            tokens_used_this_period: 12_345,
        };
        const mw = createRequireActiveSubscription(async () => row);
        const result = await mw("user-1");
        expect(result).toBeNull();
    });
});
