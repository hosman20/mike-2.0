// Single entry point for all LLM traffic. Every call is routed through the
// Vercel AI Gateway adapter in `./gateway.ts`. The per-provider files
// (claude.ts, gemini.ts, openai.ts) are retained as deprecated stubs so
// historical imports keep compiling, but they delegate here.

import { streamChat, completeChatText } from "./gateway";
import type {
    StreamChatAttribution,
    StreamChatParams,
    StreamChatResult,
} from "./types";

export * from "./types";
export * from "./models";
export { streamChat, completeChatText } from "./gateway";

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    return streamChat(params);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    attribution?: StreamChatAttribution;
    // Legacy field accepted but ignored — see UserApiKeys in ./types.ts.
    apiKeys?: unknown;
}): Promise<string> {
    return completeChatText({
        model: params.model,
        systemPrompt: params.systemPrompt,
        user: params.user,
        maxTokens: params.maxTokens,
        attribution: params.attribution,
    });
}
