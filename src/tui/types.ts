export type AutoAcceptMode = "off" | "edits" | "all";

export type TUIOptions = {
  /** Initial prompt to run (for one-shot mode) */
  initialPrompt?: string;
  /** Working directory for the agent */
  workingDirectory?: string;
  /** Custom agent options passed to stream() */
  agentOptions?: Record<string, unknown>;
};
