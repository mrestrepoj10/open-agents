import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

type StatusBarProps = {
  isStreaming: boolean;
  elapsedSeconds: number;
  tokens: number;
  status?: string;
};

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}

export function StatusBar({ isStreaming, elapsedSeconds, tokens, status }: StatusBarProps) {
  if (!isStreaming && !status) {
    return null;
  }

  return (
    <Box marginTop={1}>
      {isStreaming ? (
        <>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow"> {status || "Thinking..."}</Text>
        </>
      ) : (
        <Text color="green">✓ {status || "Done"}</Text>
      )}
      <Text color="gray">
        {" "}({formatTime(elapsedSeconds)} · ⌀ {formatTokens(tokens)} tokens · <Text color="gray">esc</Text> to interrupt)
      </Text>
    </Box>
  );
}
