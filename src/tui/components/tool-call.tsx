import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ToolUIPart, DynamicToolUIPart } from "ai";
import { getToolName } from "ai";

type ToolPart = ToolUIPart | DynamicToolUIPart;

type ToolCallProps = {
  part: ToolPart;
};

function formatToolDisplay(toolName: string, input: unknown): { name: string; summary: string } {
  const inputObj = (input ?? {}) as Record<string, unknown>;

  switch (toolName) {
    case "read":
      return {
        name: "Read",
        summary: `${inputObj.file_path || inputObj.path || ""}`,
      };
    case "write":
      return {
        name: "Write",
        summary: `${inputObj.file_path || inputObj.path || ""}`,
      };
    case "edit":
      return {
        name: "Update",
        summary: `${inputObj.file_path || inputObj.path || ""}`,
      };
    case "glob":
      return {
        name: "List",
        summary: `${inputObj.pattern || inputObj.path || ""}`,
      };
    case "grep":
      return {
        name: "Search",
        summary: `"${inputObj.pattern || ""}"`,
      };
    case "bash":
      const cmd = String(inputObj.command || "").slice(0, 50);
      return {
        name: "Bash",
        summary: cmd + (String(inputObj.command || "").length > 50 ? "..." : ""),
      };
    case "todo_write":
      return {
        name: "TodoWrite",
        summary: "Updating task list",
      };
    case "task":
      return {
        name: "Task",
        summary: `${inputObj.description || "Spawning subagent"}`,
      };
    case "memory_save":
      return {
        name: "MemorySave",
        summary: "Saving to memory",
      };
    case "memory_recall":
      return {
        name: "MemoryRecall",
        summary: `"${inputObj.query || ""}"`,
      };
    default:
      return {
        name: toolName.charAt(0).toUpperCase() + toolName.slice(1),
        summary: JSON.stringify(input).slice(0, 40),
      };
  }
}

function formatOutput(toolName: string, output: unknown): string {
  if (output === undefined || output === null) return "";

  const outputObj = output as Record<string, unknown>;

  switch (toolName) {
    case "read":
      if (outputObj.lineCount) {
        return `Read ${outputObj.lineCount} lines`;
      }
      return "File read";
    case "glob":
      if (Array.isArray(outputObj.files)) {
        return `Listed ${outputObj.files.length} paths`;
      }
      return "Files listed";
    case "grep":
      if (Array.isArray(outputObj.matches)) {
        return `Found ${outputObj.matches.length} matches`;
      }
      return "Search complete";
    case "write":
      return "File written";
    case "edit":
      if (outputObj.additions !== undefined || outputObj.removals !== undefined) {
        return `Updated with ${outputObj.additions || 0} addition${outputObj.additions !== 1 ? "s" : ""} and ${outputObj.removals || 0} removal${outputObj.removals !== 1 ? "s" : ""}`;
      }
      return "File updated";
    case "bash":
      if (outputObj.exitCode !== undefined) {
        return outputObj.exitCode === 0 ? "Command succeeded" : `Exit code ${outputObj.exitCode}`;
      }
      return "Command executed";
    default:
      const str = JSON.stringify(output);
      return str.length > 60 ? str.slice(0, 57) + "..." : str;
  }
}

export function ToolCall({ part }: ToolCallProps) {
  const toolName = getToolName(part);
  const { name, summary } = formatToolDisplay(toolName, part.input);

  const isRunning = part.state === "input-available" || part.state === "input-streaming";
  const isSuccess = part.state === "output-available";
  const isError = part.state === "output-error";

  const dotColor = isRunning ? "yellow" : isSuccess ? "green" : "red";

  return (
    <Box flexDirection="column" marginBottom={0}>
      {/* Main tool line */}
      <Box>
        {isRunning ? (
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text color={dotColor}>●</Text>
        )}
        <Text> </Text>
        <Text bold>{name}</Text>
        <Text color="gray">(</Text>
        <Text color="cyan">{summary}</Text>
        <Text color="gray">)</Text>
      </Box>

      {/* Output line (if completed) */}
      {isSuccess && part.output !== undefined && (
        <Box marginLeft={2}>
          <Text color="gray">└ </Text>
          <Text>{String(formatOutput(toolName, part.output))}</Text>
          <Text color="gray"> (ctrl+r to expand)</Text>
        </Box>
      )}

      {/* Error line (if error) */}
      {isError && "errorText" in part && part.errorText !== undefined && (
        <Box marginLeft={2}>
          <Text color="gray">└ </Text>
          <Text color="red">Error: {part.errorText.slice(0, 80)}</Text>
        </Box>
      )}
    </Box>
  );
}
