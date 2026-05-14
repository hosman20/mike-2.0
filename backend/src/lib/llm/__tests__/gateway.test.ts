import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// We intercept the `ai` package so the gateway never hits a real provider.
// `streamText` is captured per-call so each test can inspect the args it
// received, drive its `onChunk` callback to simulate a streamed response,
// and verify the headers / model slug we sent.

type StreamTextArgs = {
    model: unknown;
    system?: string;
    messages?: unknown;
    tools?: Record<string, unknown>;
    headers?: Record<string, string>;
    providerOptions?: unknown;
    onChunk?: (event: {
        chunk:
            | { type: "text-delta"; text: string }
            | { type: "reasoning-delta"; text: string }
            | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown };
    }) => void;
    onStepFinish?: () => void;
    stopWhen?: unknown;
    maxOutputTokens?: number;
};

const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
const toolMock = vi.fn((def: Record<string, unknown>) => def);
const jsonSchemaMock = vi.fn(
    (schema: Record<string, unknown>) => ({ jsonSchema: schema }),
);
const stepCountIsMock = vi.fn((n: number) => ({ kind: "stepCountIs", value: n }));

vi.mock("ai", () => ({
    streamText: (args: StreamTextArgs) => streamTextMock(args),
    generateText: (args: unknown) => generateTextMock(args),
    tool: (def: Record<string, unknown>) => toolMock(def),
    jsonSchema: (schema: Record<string, unknown>) => jsonSchemaMock(schema),
    stepCountIs: (n: number) => stepCountIsMock(n),
}));

// Lazy import so the mocks above register before module-eval.
async function loadGateway() {
    return await import("../gateway");
}

beforeEach(() => {
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    toolMock.mockReset();
    jsonSchemaMock.mockReset();
    stepCountIsMock.mockReset();

    // Default: streamText returns a successful result object with a resolved
    // text promise. Tests override per-case when they need streaming behavior.
    streamTextMock.mockImplementation((_args: StreamTextArgs) => ({
        text: Promise.resolve(""),
    }));
    generateTextMock.mockResolvedValue({ text: "ok" });
});

afterEach(() => {
    vi.resetModules();
});

describe("toGatewayModelId", () => {
    test("maps Claude models to anthropic/claude-*.* slugs (dotted versions)", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-sonnet-4-6",
            systemPrompt: "you are a lawyer",
            messages: [{ role: "user", content: "hi" }],
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.model).toBe("anthropic/claude-sonnet-4.6");
    });

    test("maps OpenAI models to openai/* slugs", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "gpt-5.5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.model).toBe("openai/gpt-5.5");
    });

    test("maps Gemini models to google/* slugs", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "gemini-3-flash-preview",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.model).toBe("google/gemini-3-flash-preview");
    });

    test("throws on unknown provider prefix", async () => {
        const { streamChat } = await loadGateway();
        await expect(
            streamChat({
                model: "mystery-model",
                systemPrompt: "",
                messages: [{ role: "user", content: "hi" }],
            }),
        ).rejects.toThrow(/Unknown model id/);
    });
});

describe("attribution headers", () => {
    test("includes x-user-id and x-org-id when both supplied", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
            attribution: { userId: "user-123", orgId: "org-abc" },
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.headers).toEqual({
            "x-user-id": "user-123",
            "x-org-id": "org-abc",
        });
    });

    test("includes only x-user-id when orgId is absent", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
            attribution: { userId: "user-123" },
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.headers).toEqual({ "x-user-id": "user-123" });
    });

    test("omits headers entirely when no attribution is given", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.headers).toBeUndefined();
    });
});

describe("streaming callbacks", () => {
    test("forwards text-delta chunks to onContentDelta and accumulates fullText", async () => {
        streamTextMock.mockImplementationOnce((args: StreamTextArgs) => {
            args.onChunk?.({ chunk: { type: "text-delta", text: "Hello " } });
            args.onChunk?.({ chunk: { type: "text-delta", text: "world." } });
            return { text: Promise.resolve("Hello world.") };
        });

        const received: string[] = [];
        const { streamChat } = await loadGateway();
        const result = await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
            callbacks: {
                onContentDelta: (delta) => received.push(delta),
            },
        });

        expect(received).toEqual(["Hello ", "world."]);
        expect(result.fullText).toBe("Hello world.");
    });

    test("forwards reasoning-delta chunks and fires onReasoningBlockEnd at step boundary", async () => {
        streamTextMock.mockImplementationOnce((args: StreamTextArgs) => {
            args.onChunk?.({ chunk: { type: "reasoning-delta", text: "thinking..." } });
            args.onChunk?.({ chunk: { type: "text-delta", text: "done." } });
            args.onStepFinish?.();
            return { text: Promise.resolve("done.") };
        });

        const reasoning: string[] = [];
        let reasoningEnded = 0;
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
            enableThinking: true,
            callbacks: {
                onReasoningDelta: (d) => reasoning.push(d),
                onReasoningBlockEnd: () => {
                    reasoningEnded += 1;
                },
            },
        });

        expect(reasoning).toEqual(["thinking..."]);
        expect(reasoningEnded).toBe(1);
    });
});

describe("tool plumbing", () => {
    test("converts OpenAI-style tool schemas into a ToolSet keyed by name", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "lookup_case",
                        description: "look up a case",
                        parameters: {
                            type: "object",
                            properties: { id: { type: "string" } },
                            required: ["id"],
                        },
                    },
                },
            ],
            runTools: async () => [
                { tool_use_id: "call-1", content: "case found" },
            ],
        });

        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(Object.keys(args.tools ?? {})).toEqual(["lookup_case"]);
        // stopWhen is gated on having tools.
        expect(args.stopWhen).toEqual({ kind: "stepCountIs", value: 10 });
    });

    test("omits stopWhen when there are no tools", async () => {
        const { streamChat } = await loadGateway();
        await streamChat({
            model: "claude-haiku-4-5",
            systemPrompt: "",
            messages: [{ role: "user", content: "hi" }],
        });
        const args = streamTextMock.mock.calls[0][0] as StreamTextArgs;
        expect(args.tools).toBeUndefined();
        expect(args.stopWhen).toBeUndefined();
    });
});

describe("completeChatText", () => {
    test("calls generateText with mapped model id and headers", async () => {
        generateTextMock.mockResolvedValueOnce({ text: "Title Here" });
        const { completeChatText } = await loadGateway();
        const result = await completeChatText({
            model: "gemini-3.1-flash-lite-preview",
            user: "make a title",
            attribution: { userId: "u-1" },
        });
        expect(result).toBe("Title Here");
        const args = generateTextMock.mock.calls[0][0] as {
            model: string;
            headers?: Record<string, string>;
        };
        expect(args.model).toBe("google/gemini-3.1-flash-lite-preview");
        expect(args.headers).toEqual({ "x-user-id": "u-1" });
    });
});
