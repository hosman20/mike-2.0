// ---------------------------------------------------------------------------
// Vercel AI Gateway smoke test
// ---------------------------------------------------------------------------
//
// Purpose:
//   Verify end-to-end that the AI Gateway integration is functional. This
//   catches credential breakage, model-slug drift, and gateway-side rate
//   limit / spend-cap regressions BEFORE they hit a real chat request in
//   production. Designed to be a manual pre-deploy check that an operator
//   runs against staging or prod.
//
// Env required:
//   - VERCEL_OIDC_TOKEN (preferred), OR
//   - AI_GATEWAY_API_KEY (fallback)
//   The script exits non-zero with a clear error if neither is set.
//   Loads `.env` automatically via `dotenv/config`.
//
// How to run:
//   cd backend && npx tsx scripts/smoke-gateway.ts
//   # or
//   cd backend && npm run smoke:gateway
//
// Expected output (success):
//   [smoke] credentials: AI_GATEWAY_API_KEY
//   [smoke] response: smoke test ok
//   [smoke] usage: input=… output=… total=…
//   [smoke] PASS
//   (exit 0)
//
// Expected output (failure):
//   A descriptive error line on stderr and exit 1.
//
// Cost: One Haiku request, ~50 output tokens. < 1 cent.
// Runtime: < 5 seconds in the happy path; hard 30s timeout enforced.
// ---------------------------------------------------------------------------

import "dotenv/config";
import { streamText } from "ai";

const SMOKE_MODEL = "anthropic/claude-haiku-4.5";
const SMOKE_PROMPT =
    "Reply with the literal string `smoke test ok` and nothing else.";
const MAX_OUTPUT_TOKENS = 50;
const TIMEOUT_MS = 30_000;

function fail(message: string): never {
    process.stderr.write(`[smoke] FAIL: ${message}\n`);
    process.exit(1);
}

function resolveCredentialSource(): "VERCEL_OIDC_TOKEN" | "AI_GATEWAY_API_KEY" {
    // Match the resolution order documented in `src/lib/llm/gateway.ts`:
    // OIDC first, static gateway key as fallback.
    if (process.env.VERCEL_OIDC_TOKEN) return "VERCEL_OIDC_TOKEN";
    if (process.env.AI_GATEWAY_API_KEY) return "AI_GATEWAY_API_KEY";
    fail(
        "no gateway credentials found. Set VERCEL_OIDC_TOKEN (preferred) or AI_GATEWAY_API_KEY in your environment / .env file before running this script.",
    );
}

async function runSmoke(): Promise<void> {
    const credSource = resolveCredentialSource();
    process.stdout.write(`[smoke] credentials: ${credSource}\n`);
    process.stdout.write(`[smoke] model: ${SMOKE_MODEL}\n`);

    let text = "";
    let result;
    try {
        result = streamText({
            model: SMOKE_MODEL,
            prompt: SMOKE_PROMPT,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            onChunk: ({ chunk }) => {
                if (chunk.type === "text-delta" && chunk.text) {
                    text += chunk.text;
                }
            },
        });
        // Drain the stream by awaiting the final text promise.
        await result.text;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`gateway request threw: ${msg}`);
    }

    process.stdout.write(`[smoke] response: ${text.trim()}\n`);

    if (!text.trim()) {
        fail("response text was empty.");
    }

    let usage: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
    } | null = null;
    try {
        usage = (await result.usage) as typeof usage;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(`could not read usage from gateway response: ${msg}`);
    }

    if (!usage) {
        fail("usage was missing from gateway response.");
    }

    const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
    const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
    const totalTokens =
        usage.totalTokens ?? inputTokens + outputTokens;
    process.stdout.write(
        `[smoke] usage: input=${inputTokens} output=${outputTokens} total=${totalTokens}\n`,
    );

    if (!(inputTokens > 0)) {
        fail(`expected inputTokens > 0, got ${inputTokens}.`);
    }
    if (!(outputTokens > 0)) {
        fail(`expected outputTokens > 0, got ${outputTokens}.`);
    }

    process.stdout.write("[smoke] PASS\n");
}

async function main(): Promise<void> {
    // Hard timeout — the gateway should answer Haiku in <5s. If it doesn't,
    // something is wrong and we'd rather fail loudly than hang CI.
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(
            () =>
                reject(
                    new Error(
                        `smoke test exceeded ${TIMEOUT_MS}ms timeout — gateway is slow or hung.`,
                    ),
                ),
            TIMEOUT_MS,
        ),
    );

    try {
        await Promise.race([runSmoke(), timeout]);
        process.exit(0);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail(msg);
    }
}

void main();
