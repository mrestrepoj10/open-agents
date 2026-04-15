import type {
  AgentModelSelection,
  OpenHarnessAgentCallOptions,
  OpenHarnessAgentModelInput,
} from "@open-harness/agent";
import { getUserCodexModelConfig } from "@/lib/codex/token";

function toSelection(
  input: OpenHarnessAgentModelInput | undefined,
): AgentModelSelection | undefined {
  if (!input) {
    return undefined;
  }

  return typeof input === "string" ? { id: input } : { ...input };
}

async function resolveSelection(
  userId: string,
  input: OpenHarnessAgentModelInput | undefined,
): Promise<OpenHarnessAgentModelInput | undefined> {
  const selection = toSelection(input);
  if (!selection) {
    return undefined;
  }

  if (
    selection.authSource !== "codex-subscription" ||
    !selection.id.startsWith("openai/")
  ) {
    return selection;
  }

  const codexConfig = await getUserCodexModelConfig(userId);
  if (!codexConfig) {
    return {
      ...selection,
      authSource: "gateway",
      config: undefined,
    };
  }

  return {
    ...selection,
    config: codexConfig,
  };
}

export async function resolveAgentOptionsForStep(
  userId: string,
  agentOptions: OpenHarnessAgentCallOptions,
): Promise<OpenHarnessAgentCallOptions> {
  const [model, subagentModel] = await Promise.all([
    resolveSelection(userId, agentOptions.model),
    resolveSelection(userId, agentOptions.subagentModel),
  ]);

  return {
    ...agentOptions,
    ...(model ? { model } : {}),
    ...(subagentModel ? { subagentModel } : {}),
  };
}
