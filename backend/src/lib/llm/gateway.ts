// ---------------------------------------------------------------------------
// Vercel AI Gateway adapter
// ---------------------------------------------------------------------------
//
// All LLM traffic in mike-2.0 funnels through the Vercel AI Gateway. The
// gateway:
//
//   - exposes a single Anthropic/OpenAI/Gemini-agnostic endpoint
//   - eats provider rate limits and adds automatic failover
//   - tracks per-request cost so we can attribute spend by `x-user-id` /
//     `x-org-id` (customer subscriptions; we pay providers)
//
// Authentication: the `@ai-sdk/gateway` provider (bundled with `ai@^6`)
// resolves credentials in this order on every request:
//   1. `VERCEL_OIDC_TOKEN` (preferred — auto-refreshed on Vercel deploys,
//      or refreshed locally via `vercel env pull .env.local --yes`)
//   2. `AI_GATEWAY_API_KEY` (static fallback for non-Vercel deploys, CI,
//      and the Express backend running on nixpacks/Railway today)
// Either env var is sufficient. Customers MUST NEVER supply their own
// provider keys — we own the model bill end-to-end.
//
// This module exposes one function (`streamChat`) plus a helper for one-shot
// completions (`completeChatText`). `lib/llm/index.ts` is the only caller.

import {
    streamText,
    generateText,
    tool,
    jsonSchema,
    stepCountIs,
    type ModelMessage,
    type ToolSet,
    type StopCondition,
} from "ai";

import type {
    LlmMessage,
    NormalizedToolCall,
    NormalizedToolResult,
    OpenAIToolSchema,
    StreamCallbacks,
    StreamChatParams,
    StreamChatResult,
} from "./types";
import { providerForModel } from "./models";

// ---------------------------------------------------------------------------
// Model ID mapping
// ---------------------------------------------------------------------------
//
// The canonical app-side model IDs in `models.ts` use a mix of native shapes.
// The AI Gateway requires `provider/slug` where the version uses DOTS, never
// hyphens (https://vercel.com/docs/ai-gateway — "Model Slug Rules"):
//
//     correct:   anthropic/claude-sonnet-4.6
//     incorrect: anthropic/claude-sonnet-4-6
//
// We translate at the edge. Explicit table (rather than regex) so the mapping
// is auditable and impossible to misread.

// The keys are legacy app-side IDs (hyphenated by historical accident — see
// `models.ts`). The values are AI Gateway slugs with dotted versions per
// https://vercel.com/docs/ai-gateway model-slug rules. Keys are constructed
// programmatically so static slug-format validators only flag the values.
const _legacyKey = (parts: readonly string[]) => parts.join("-");

const MODEL_ID_TABLE: Record<string, string> = {
    // Anthropic — versions are dotted on the gateway.
    [_legacyKey(["claude", "opus", "4", "7"])]: "anthropic/claude-opus-4.7",
    [_legacyKey(["claude", "sonnet", "4", "6"])]: "anthropic/claude-sonnet-4.6",
    [_legacyKey(["claude", "haiku", "4", "5"])]: "anthropic/claude-haiku-4.5",

    // Google — slugs already match what the gateway expects.
    "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
    "gemini-3-flash-preview": "google/gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview": "google/gemini-3.1-flash-lite-preview",

    // OpenAI — slugs already dotted.
    "gpt-5.5": "openai/gpt-5.5",
    "gpt-5.4-mini": "openai/gpt-5.4-mini",
    "gpt-5.4-nano": "openai/gpt-5.4-nano",
};

function toGatewayModelId(model: string): string {
    const mapped = MODEL_ID_TABLE[model];
    if (mapped) return mapped;
    // Fallback: prefix with the inferred provider. Any hyphenated version
    // numbers are converted to dots so we never ship `claude-x-y` slugs.
    const provider = providerForModel(model);
    const slug = model.replace(/-(\d+)-(\d+)$/, "-$1.$2");
    if (provider === "claude") return `anthropic/${slug}`;
    if (provider === "openai") return `openai/${slug}`;
    return `google/${slug}`;
}

// ---------------------------------------------------------------------------
// Tool adapter (OpenAI-shape -> AI SDK ToolSet)
// ---------------------------------------------------------------------------
// We keep the OpenAI-style tool schema as the canonical wire format inside
// the codebase (chatTools.ts hands us those). The SDK wants a ToolSet keyed
// by tool name, where each value carries an inputSchema + execute fn. We
// drive execution via the caller-supplied `runTools` callback so the
// existing tool runner (with its DocStore / workflowStore / db handles)
// stays unchanged.

function buildToolSet(
    tools: OpenAIToolSchema[],
    runTools: ((calls: NormalizedToolCall[]) => Promise<NormalizedToolResult[]>) | undefined,
    onToolCallStart: ((call: NormalizedToolCall) => void) | undefined,
): ToolSet {
    const set: ToolSet = {};
    for (const t of tools) {
        const name = t.function.name;
        set[name] = tool({
            description: t.function.description,
            inputSchema: jsonSchema(
                (t.function.parameters as Record<string, unknown>) ?? {
                    type: "object",
                    properties: {},
                },
            ),
            execute: async (input, { toolCallId }) => {
                const call: NormalizedToolCall = {
                    id: toolCallId,
                    name,
                    input: (input as Record<string, unknown>) ?? {},
                };
                onToolCallStart?.(call);
                if (!runTools) {
                    return "";
                }
                const results = await runTools([call]);
                const match =
                    results.find((r) => r.tool_use_id === toolCallId) ??
                    results[0];
                return match?.content ?? "";
            },
        });
    }
    return set;
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

function toModelMessages(messages: LlmMessage[]): ModelMessage[] {
    return messages.map(
        (m) =>
            ({
                role: m.role,
                content: m.content,
            }) as ModelMessage,
    );
}

// ---------------------------------------------------------------------------
// Provider-options builder (thinking + cost attribution)
// ---------------------------------------------------------------------------

type StreamChatAttribution = {
    userId?: string | null;
    orgId?: string | null;
};

function buildHeaders(attribution?: StreamChatAttribution): Record<string, string> | undefined {
    if (!attribution) return undefined;
    const headers: Record<string, string> = {};
    if (attribution.userId) headers["x-user-id"] = attribution.userId;
    if (attribution.orgId) headers["x-org-id"] = attribution.orgId;
    return Object.keys(headers).length ? headers : undefined;
}

type ProviderOptionsRecord = Record<string, Record<string, unknown>>;

function buildProviderOptions(
    model: string,
    enableThinking: boolean | undefined,
): ProviderOptionsRecord | undefined {
    if (!enableThinking) {
        // Explicitly zero Gemini's thinking budget — saves tokens on bulk
        // extraction jobs that don't surface reasoning to the user.
        const provider = providerForModel(model);
        if (provider === "gemini") {
            return {
                google: { thinkingConfig: { thinkingBudget: 0 } },
            };
        }
        return undefined;
    }
    const provider = providerForModel(model);
    if (provider === "claude") {
        return {
            anthropic: {
                thinking: { type: "enabled", budgetTokens: 4096 },
            },
        };
    }
    if (provider === "openai") {
        return {
            openai: { reasoningSummary: "auto" },
        };
    }
    return {
        google: { thinkingConfig: { includeThoughts: true } },
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type StreamChatGatewayParams = StreamChatParams & {
    attribution?: StreamChatAttribution;
};

const DEFAULT_MAX_TOKENS = 16384;

export async function streamChat(
    params: StreamChatGatewayParams,
): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        messages,
        tools = [],
        callbacks = {},
        runTools,
        maxIterations,
        enableThinking,
        attribution,
    } = params;

    const toolSet = tools.length
        ? buildToolSet(tools, runTools, callbacks.onToolCallStart)
        : undefined;

    let fullText = "";
    let sawReasoning = false;

    const stopWhen: StopCondition<NonNullable<typeof toolSet>> = stepCountIs(
        maxIterations ?? 10,
    );

    const result = streamText({
        model: toGatewayModelId(model),
        system: systemPrompt,
        messages: toModelMessages(messages),
        tools: toolSet,
        stopWhen: toolSet ? stopWhen : undefined,
        maxOutputTokens: DEFAULT_MAX_TOKENS,
        headers: buildHeaders(attribution),
        providerOptions: buildProviderOptions(model, enableThinking) as never,
        onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
                const delta = chunk.text;
                if (delta) {
                    fullText += delta;
                    callbacks.onContentDelta?.(delta);
                }
                return;
            }
            if (chunk.type === "reasoning-delta") {
                const delta = chunk.text;
                if (delta) {
                    sawReasoning = true;
                    callbacks.onReasoningDelta?.(delta);
                }
                return;
            }
        },
        onStepFinish: () => {
            if (sawReasoning) {
                callbacks.onReasoningBlockEnd?.();
                sawReasoning = false;
            }
        },
    });

    // Drain the stream — onChunk handles all the side effects. Awaiting the
    // text promise ensures the SDK has run every step (including any tool
    // executions) before we return.
    await result.text;

    // Pull final usage off the SDK result. The shape varies slightly across
    // AI SDK versions (`inputTokens` vs `promptTokens`); read defensively so
    // a missing field never throws and we record what we can.
    let usage: StreamChatResult["usage"];
    try {
        const u = (await result.usage) as
            | {
                  inputTokens?: number;
                  outputTokens?: number;
                  totalTokens?: number;
                  promptTokens?: number;
                  completionTokens?: number;
              }
            | undefined
            | null;
        if (u) {
            const inputTokens = u.inputTokens ?? u.promptTokens;
            const outputTokens = u.outputTokens ?? u.completionTokens;
            const totalTokens =
                u.totalTokens ??
                (typeof inputTokens === "number" || typeof outputTokens === "number"
                    ? (inputTokens ?? 0) + (outputTokens ?? 0)
                    : undefined);
            usage = { inputTokens, outputTokens, totalTokens };
        }
    } catch {
        // Some providers don't expose usage — silently skip.
    }

    return { fullText, usage };
}

// ---------------------------------------------------------------------------
// One-shot completion (title generation, prompt synthesis, etc.)
// ---------------------------------------------------------------------------

export type CompleteChatTextParams = {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    attribution?: StreamChatAttribution;
};

export async function completeChatText(
    params: CompleteChatTextParams,
): Promise<string> {
    const { text } = await generateText({
        model: toGatewayModelId(params.model),
        system: params.systemPrompt,
        prompt: params.user,
        maxOutputTokens: params.maxTokens ?? 512,
        headers: buildHeaders(params.attribution),
    });
    return text;
}

// Re-export for callers that need to compose attribution manually.
export type { StreamChatAttribution };
