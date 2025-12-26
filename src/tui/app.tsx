import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { ToolLoopAgent, UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { useChat } from "@ai-sdk/react";
import { createAgentTransport } from "./transport.js";
import { ToolCall } from "./components/tool-call.js";
import { StatusBar } from "./components/status-bar.js";
import { InputBox } from "./components/input-box.js";
import type { TUIOptions, AutoAcceptMode } from "./types.js";

type AppProps = {
  agent: ToolLoopAgent<any, any, any>;
  options?: TUIOptions;
};

function renderPart(part: UIMessage["parts"][number], key: string) {
  // Handle tool parts (both static and dynamic)
  if (isToolUIPart(part)) {
    return <ToolCall key={key} part={part} />;
  }

  switch (part.type) {
    case "text":
      if (!part.text) return null;
      return (
        <Box key={key}>
          <Text>
            <Text color="white">● </Text>
            {part.text}
          </Text>
        </Box>
      );

    case "reasoning":
      if (!part.text) return null;
      return (
        <Box key={key}>
          <Text color="blue" dimColor>
            {part.text}
          </Text>
        </Box>
      );

    default:
      return null;
  }
}

function renderMessage(message: UIMessage) {
  if (message.role === "user") {
    // Get text from user message parts
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

    return (
      <Box key={message.id} marginTop={1} marginBottom={1}>
        <Text color="magenta" bold>
          &gt;{" "}
        </Text>
        <Text color="white" bold>
          {text}
        </Text>
      </Box>
    );
  }

  if (message.role === "assistant") {
    return (
      <Box key={message.id} flexDirection="column">
        {message.parts.map((part, index) =>
          renderPart(part, `${message.id}-${index}`)
        )}
      </Box>
    );
  }

  return null;
}

const AUTO_ACCEPT_MODES: AutoAcceptMode[] = ["off", "edits", "all"];

export function App({ agent, options }: AppProps) {
  const { exit } = useApp();
  const [autoAcceptMode, setAutoAcceptMode] = useState<AutoAcceptMode>("edits");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const transport = useMemo(
    () =>
      createAgentTransport({
        agent,
        agentOptions: options?.agentOptions,
      }),
    [agent, options?.agentOptions]
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Timer for elapsed seconds
  useEffect(() => {
    if (isStreaming && startTime) {
      const timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isStreaming, startTime]);

  // Handle escape key to abort
  useInput((input, key) => {
    if (key.escape) {
      if (isStreaming) {
        stop();
      } else {
        exit();
      }
    }
    if (input === "c" && key.ctrl) {
      stop();
      exit();
    }
  });

  // Run initial prompt if provided
  useEffect(() => {
    if (options?.initialPrompt) {
      setStartTime(Date.now());
      sendMessage({ text: options.initialPrompt });
    }
  }, []);

  const handleSubmit = useCallback(
    (prompt: string) => {
      if (!isStreaming) {
        setStartTime(Date.now());
        setElapsedSeconds(0);
        sendMessage({ text: prompt });
      }
    },
    [isStreaming, sendMessage]
  );

  const toggleAutoAccept = useCallback(() => {
    setAutoAcceptMode((prev) => {
      const currentIndex = AUTO_ACCEPT_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % AUTO_ACCEPT_MODES.length;
      return AUTO_ACCEPT_MODES[nextIndex] ?? "off";
    });
  }, []);

  // Get status text based on current activity
  const getStatusText = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      const runningTool = lastMessage.parts.find(
        (p) => isToolUIPart(p) && (p.state === "input-available" || p.state === "input-streaming")
      );
      if (runningTool && isToolUIPart(runningTool)) {
        return `${getToolName(runningTool)}...`;
      }
    }
    return "Thinking...";
  };

  return (
    <Box flexDirection="column" padding={0}>
      {/* Render all messages */}
      <Box flexDirection="column">
        {messages.map((message) => renderMessage(message))}

        {/* Error display */}
        {error && (
          <Box marginTop={1}>
            <Text color="red">Error: {error.message}</Text>
          </Box>
        )}
      </Box>

      {/* Status bar (only when streaming) */}
      {isStreaming && (
        <StatusBar
          isStreaming={isStreaming}
          elapsedSeconds={elapsedSeconds}
          tokens={0}
          status={getStatusText()}
        />
      )}

      {/* Input box */}
      <InputBox
        onSubmit={handleSubmit}
        autoAcceptMode={autoAcceptMode}
        onToggleAutoAccept={toggleAutoAccept}
        disabled={isStreaming}
      />
    </Box>
  );
}
