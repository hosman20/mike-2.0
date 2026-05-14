import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — registered BEFORE importing the route module.
// ---------------------------------------------------------------------------

const constructEventMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("../../lib/stripe", async (importOriginal) => {
    const actual =
        (await importOriginal()) as typeof import("../../lib/stripe");
    return {
        ...actual,
        constructWebhookEvent: (...args: unknown[]) => constructEventMock(...args),
        // The route only calls constructWebhookEvent, createCheckoutSession,
        // and createBillingPortalSession on its non-webhook paths — we keep
        // actuals for tierForPriceId / tokenLimitForTier / type exports.
    };
});

// Chainable Supabase query builder. Every test scenario stops at a
// terminal that resolves to { data, error }, and the chain assignments
// below let the route call .upsert(), .update().eq().select().maybeSingle()
// etc. without falling off the mock.
function makeChain(terminal: { data?: unknown; error?: unknown } = {}) {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const thenable: PromiseLike<typeof terminal> = {
        then: (resolve) => Promise.resolve(terminal).then(resolve),
    };
    chain.upsert = vi.fn((...a) => {
        upsertMock(...a);
        return { ...chain, ...thenable };
    });
    chain.update = vi.fn((...a) => {
        updateMock(...a);
        return chain;
    });
    chain.eq = vi.fn((...a) => {
        eqMock(...a);
        return chain;
    });
    chain.select = vi.fn((...a) => {
        selectMock(...a);
        return chain;
    });
    chain.maybeSingle = vi.fn(() => {
        maybeSingleMock();
        return Promise.resolve(terminal);
    });
    chain.single = chain.maybeSingle;
    return chain;
}

let supabaseTerminal: { data?: unknown; error?: unknown } = { data: { id: "sub-1" } };
vi.mock("../../lib/supabase", () => ({
    createServerSupabase: () => ({
        from: () => makeChain(supabaseTerminal),
    }),
}));

// Auth middleware short-circuit — the webhook test doesn't go through
// requireAuth, and the other paths aren't exercised here.
vi.mock("../../middleware/auth", () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from "express";
import { billingRouter, handleStripeEvent } from "../billing";

function buildApp() {
    const app = express();
    // Webhook needs raw body parsing — mirror the mount in src/index.ts.
    app.post(
        "/api/billing/webhook",
        express.raw({ type: "application/json", limit: "1mb" }),
    );
    app.use(express.json());
    app.use("/api/billing", billingRouter);
    return app;
}

// Minimal supertest-less HTTP roundtripper. We call the express app
// directly via its request handler with a fake req/res so we don't pull
// in an extra dep for one suite.
function callApp(
    app: express.Express,
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: Buffer | string,
): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve) => {
        const req = new (require("http").IncomingMessage)(null) as any;
        req.method = method;
        req.url = path;
        req.headers = headers;
        // Express's raw body middleware reads from the stream; emit one
        // chunk + end.
        process.nextTick(() => {
            if (body !== undefined) req.emit("data", Buffer.from(body));
            req.emit("end");
        });
        const res = new (require("http").ServerResponse)(req) as any;
        let statusCode = 200;
        let payload: unknown;
        res.writeHead = (code: number) => {
            statusCode = code;
            return res;
        };
        Object.defineProperty(res, "statusCode", {
            get: () => statusCode,
            set: (v: number) => {
                statusCode = v;
            },
        });
        res.end = (data?: string) => {
            try {
                payload = data ? JSON.parse(data) : undefined;
            } catch {
                payload = data;
            }
            resolve({ status: statusCode, body: payload });
        };
        app(req, res);
    });
}

beforeEach(() => {
    constructEventMock.mockReset();
    upsertMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    maybeSingleMock.mockReset();
    supabaseTerminal = { data: { id: "sub-1" } };
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
});

describe("POST /api/billing/webhook — signature verification", () => {
    test("rejects requests without a Stripe-Signature header", async () => {
        const app = buildApp();
        const result = await callApp(
            app,
            "POST",
            "/api/billing/webhook",
            { "content-type": "application/json" },
            JSON.stringify({ id: "evt_1" }),
        );
        expect(result.status).toBe(400);
        expect(constructEventMock).not.toHaveBeenCalled();
    });

    test("rejects requests with an invalid signature", async () => {
        constructEventMock.mockImplementation(() => {
            throw new Error("No signatures found matching the expected signature");
        });
        const app = buildApp();
        const result = await callApp(
            app,
            "POST",
            "/api/billing/webhook",
            {
                "content-type": "application/json",
                "stripe-signature": "t=1,v1=bogus",
            },
            JSON.stringify({ id: "evt_1" }),
        );
        expect(result.status).toBe(400);
        expect(constructEventMock).toHaveBeenCalledOnce();
    });
});

describe("handleStripeEvent — event handlers", () => {
    test("checkout.session.completed upserts a subscription row", async () => {
        await handleStripeEvent({
            id: "evt_1",
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_1",
                    customer: "cus_123",
                    subscription: "sub_123",
                    client_reference_id: "user-1",
                    metadata: { user_id: "user-1", tier: "starter" },
                },
            },
        } as never);
        expect(upsertMock).toHaveBeenCalledOnce();
        const args = upsertMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(args.user_id).toBe("user-1");
        expect(args.tier).toBe("starter");
        expect(args.status).toBe("active");
        expect(args.stripe_customer_id).toBe("cus_123");
        expect(args.stripe_subscription_id).toBe("sub_123");
    });

    test("customer.subscription.deleted marks status as canceled", async () => {
        await handleStripeEvent({
            id: "evt_2",
            type: "customer.subscription.deleted",
            data: {
                object: {
                    id: "sub_123",
                    customer: "cus_123",
                    cancel_at_period_end: false,
                    items: { data: [] },
                },
            },
        } as never);
        expect(updateMock).toHaveBeenCalled();
        const args = updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(args.status).toBe("canceled");
    });
});
