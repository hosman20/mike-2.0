// ---------------------------------------------------------------------------
// Live AI Gateway model-slug drift test (skip-by-default)
// ---------------------------------------------------------------------------
//
// This test hits the live Vercel AI Gateway models endpoint and verifies
// every slug we ship in `MODEL_ID_TABLE` (see `gateway.ts`) still exists.
// Vercel occasionally renames preview-suffixed slugs; without this test,
// drift only surfaces when a real chat request 404s in production.
//
// Run with: `RUN_LIVE_GATEWAY_TESTS=1 npm test`
// Or via:   `npm run test:gateway-live`
//
// Skipped by default so the regular `npm test` stays hermetic and offline.
// The models endpoint is unauthenticated — no gateway key required.
// ---------------------------------------------------------------------------

import { describe, expect, test } from "vitest";
import { MODEL_ID_TABLE } from "../gateway";

const MODELS_ENDPOINT = "https://ai-gateway.vercel.sh/v1/models";

describe.skipIf(!process.env.RUN_LIVE_GATEWAY_TESTS)(
    "gateway live slug drift",
    () => {
        test(
            "every MODEL_ID_TABLE slug exists in the live gateway catalog",
            async () => {
                const response = await fetch(MODELS_ENDPOINT);
                expect(response.ok, `gateway returned HTTP ${response.status}`).toBe(true);

                const payload = (await response.json()) as {
                    data?: Array<{ id?: string }>;
                };
                const liveIds = new Set(
                    (payload.data ?? [])
                        .map((m) => m.id)
                        .filter((id): id is string => typeof id === "string"),
                );

                expect(liveIds.size).toBeGreaterThan(0);

                const ourSlugs = Object.values(MODEL_ID_TABLE);
                const drifted = ourSlugs.filter((slug) => !liveIds.has(slug));

                expect(
                    drifted,
                    `The following slugs in MODEL_ID_TABLE are NOT in the live gateway catalog and have likely been renamed or removed:\n  - ${drifted.join("\n  - ")}\n\nUpdate backend/src/lib/llm/gateway.ts MODEL_ID_TABLE to match the current ids returned by ${MODELS_ENDPOINT}.`,
                ).toEqual([]);
            },
            30_000,
        );
    },
);
