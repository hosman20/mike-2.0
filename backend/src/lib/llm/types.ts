// Shared types for the LLM provider adapter.
// All traffic flows through the Vercel AI Gateway (`./gateway.ts`); the per-
// provider files are deprecated. Callers still hand us OpenAI-style tool
// schemas and `{ role, content }` messages — the gateway adapter translates
// internally.

export type Provider = "claude" | "gemini" | "openai";

export type OpenAIToolSchema = {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
};

export type LlmMessage = {
    role: "user" | "assistant";
    content: string;
};

export type NormalizedToolCall = {
    id: string;
    name: string;
    input: Record<string, unknown>;
};

export type NormalizedToolResult = {
    tool_use_id: string;
    content: string;
};

export type StreamCallbacks = {
    onReasoningDelta?: (text: string) => void;
    onReasoningBlockEnd?: () => void;
    onContentDelta?: (text: string) => void;
    onToolCallStart?: (call: NormalizedToolCall) => void;
};

/**
 * Optional per-request attribution headers passed to the AI Gateway so
 * spend can be sliced by customer in the Vercel dashboard.
 */
export type StreamChatAttribution = {
    userId?: string | null;
    orgId?: string | null;
};

/**
 * @deprecated Customer-supplied provider API keys are gone. Tokens are paid
 * for by the platform via the AI Gateway. This alias is kept only so the
 * `apiKeys?` field on existing call sites still typechecks during the
 * rollout. Any value passed is ignored.
 */
export type UserApiKeys = {
    claude?: string | null;
    gemini?: string | null;
    openai?: string | null;
};

export type StreamChatParams = {
    model: string;
    systemPrompt: string;
    messages: LlmMessage[];
    tools?: OpenAIToolSchema[];
    maxIterations?: number;
    callbacks?: StreamCallbacks;
    runTools?: (calls: NormalizedToolCall[]) => Promise<NormalizedToolResult[]>;
    /** @deprecated ignored — see UserApiKeys. */
    apiKeys?: UserApiKeys;
    /** Optional gateway attribution for cost tracking. */
    attribution?: StreamChatAttribution;
    /**
     * Enable provider-side reasoning/thinking. Off by default — should only
     * be turned on for interactive chat surfaces where the user actually
     * benefits from seeing the thought stream. Bulk extraction jobs and
     * one-shot completions should leave this off to save tokens and latency.
     */
    enableThinking?: boolean;
};

export type StreamChatResult = {
    fullText: string;
    /**
     * Aggregate token usage for the request, populated when the underlying
     * provider returns it. Sum of input + output tokens is used by the
     * billing layer to deduct against the user's monthly limit.
     */
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
};
