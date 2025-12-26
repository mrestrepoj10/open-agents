import React from "react";
import { render } from "ink";
import type { ToolLoopAgent } from "ai";
import { App } from "./app.js";
import type { TUIOptions } from "./types.js";

export type { TUIOptions, AutoAcceptMode } from "./types.js";

/**
 * Create a Claude Code-style TUI for any ToolLoopAgent.
 *
 * @example
 * ```ts
 * import { createTUI } from './tui';
 * import { myAgent } from './agent';
 *
 * // Interactive REPL mode
 * await createTUI(myAgent);
 *
 * // One-shot mode with initial prompt
 * await createTUI(myAgent, {
 *   initialPrompt: "Explain this codebase",
 *   agentOptions: { workingDirectory: process.cwd() }
 * });
 * ```
 */
export async function createTUI(
  agent: ToolLoopAgent<any, any, any>,
  options?: TUIOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <App agent={agent} options={options} />
  );

  await waitUntilExit();
}

/**
 * Render the TUI without waiting for exit.
 * Useful for programmatic control.
 */
export function renderTUI(
  agent: ToolLoopAgent<any, any, any>,
  options?: TUIOptions
) {
  return render(<App agent={agent} options={options} />);
}

// Re-export components for custom TUI composition
export * from "./components/index.js";

// Re-export transport for custom usage
export { createAgentTransport } from "./transport.js";
