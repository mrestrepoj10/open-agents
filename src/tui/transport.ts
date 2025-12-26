import type { ChatTransport, UIMessage, UIMessageChunk, ToolLoopAgent } from "ai";

export type AgentTransportOptions = {
  agent: ToolLoopAgent<any, any, any>;
  agentOptions?: Record<string, unknown>;
};

export function createAgentTransport({
  agent,
  agentOptions,
}: AgentTransportOptions): ChatTransport<UIMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      // Extract the prompt from the last user message
      const lastUserMessage = messages.filter((m) => m.role === "user").pop();
      const prompt =
        lastUserMessage?.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "";

      const result = await agent.stream({
        prompt,
        options: agentOptions,
        abortSignal: abortSignal ?? undefined,
      });

      // Convert AsyncIterable to ReadableStream
      const uiStream = result.toUIMessageStream();
      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          try {
            for await (const chunk of uiStream) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    },

    reconnectToStream: async () => {
      // Not supported for local agent calls
      return null;
    },
  };
}
