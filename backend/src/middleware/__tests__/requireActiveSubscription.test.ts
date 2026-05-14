import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
    createRequireActiveSubscription,
    type SubscriptionRow,
} from "../requireActiveSubscription";

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
        // chained .status().json() is what the middleware uses; status returns
        // an object whose .json we capture.
    } as unknown as Response;
    return { res, statusMock, jsonMock };
}

const makeReq = () => ({}) as Request;

const inFuture = () => new Date(Date.now() + 60_000).toISOString();
const inPast = () => new Date(Date.now() - 60_000).toISOString();

describe("requireActiveSubscription", () => {
    let next: NextFunction;

    beforeEach(() => {
        next = vi.fn();
    });

    test("active subscription under token limit → next()", async () => {
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
        const { res, statusMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(statusMock).not.toHaveBeenCalled();
    });

    test("trialing + trial not expired + under limit → next()", async () => {
        const row: SubscriptionRow = {
            id: "sub-1",
            tier: "trial",
            status: "trialing",
            trial_ends_at: inFuture(),
            current_period_end: null,
            monthly_token_limit: 1_000_000,
            tokens_used_this_period: 0,
        };
        const mw = createRequireActiveSubscription(async () => row);
        const { res, statusMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(statusMock).not.toHaveBeenCalled();
    });

    test("trial expired → 402 with reason trial_expired", async () => {
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
        const { res, statusMock, jsonMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                error: "payment_required",
                reason: "trial_expired",
                upgrade_url: "/pricing",
            }),
        );
    });

    test("token limit reached → 402 with reason token_limit_reached", async () => {
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
        const { res, statusMock, jsonMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                error: "payment_required",
                reason: "token_limit_reached",
            }),
        );
    });

    test("no subscription row → 402 with reason no_subscription", async () => {
        const mw = createRequireActiveSubscription(async () => null);
        const { res, statusMock, jsonMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "no_subscription" }),
        );
    });

    test("canceled subscription → 402 with reason subscription_inactive", async () => {
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
        const { res, statusMock, jsonMock } = makeRes();
        await mw(makeReq(), res, next);
        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "subscription_inactive" }),
        );
    });
});
