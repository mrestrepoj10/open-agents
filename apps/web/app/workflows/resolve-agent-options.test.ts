import { beforeEach, describe, expect, mock, test } from "bun:test";

const getUserCodexModelConfig = mock();

mock.module("@/lib/codex/token", () => ({
  getUserCodexModelConfig,
}));

const { resolveAgentOptionsForStep } = await import("./resolve-agent-options");

describe("resolveAgentOptionsForStep", () => {
  beforeEach(() => {
    getUserCodexModelConfig.mockReset();
  });

  test("injects Codex config for OpenAI models using the subscription source", async () => {
    const codexConfig = {
      kind: "openai-compatible" as const,
      baseURL: "https://chatgpt.com/backend-api/codex",
      apiKey: "chatgpt-oauth",
      headers: {
        Authorization: "Bearer token",
      },
      name: "openai" as const,
    };

    getUserCodexModelConfig.mockResolvedValue(codexConfig);

    const result = await resolveAgentOptionsForStep("user-1", {
      sandbox: {
        state: { type: "vercel" },
        workingDirectory: "/workspace",
      },
      model: {
        id: "openai/gpt-5.4",
        authSource: "codex-subscription",
      },
      subagentModel: {
        id: "openai/gpt-5.4-mini",
        authSource: "codex-subscription",
      },
    });

    expect(getUserCodexModelConfig).toHaveBeenCalledTimes(2);
    expect(result.model).toEqual({
      id: "openai/gpt-5.4",
      authSource: "codex-subscription",
      config: codexConfig,
    });
    expect(result.subagentModel).toEqual({
      id: "openai/gpt-5.4-mini",
      authSource: "codex-subscription",
      config: codexConfig,
    });
  });

  test("falls back to the gateway source when no Codex credential is available", async () => {
    getUserCodexModelConfig.mockResolvedValue(null);

    const result = await resolveAgentOptionsForStep("user-1", {
      sandbox: {
        state: { type: "vercel" },
        workingDirectory: "/workspace",
      },
      model: {
        id: "openai/gpt-5.4",
        authSource: "codex-subscription",
      },
    });

    expect(result.model).toEqual({
      id: "openai/gpt-5.4",
      authSource: "gateway",
      config: undefined,
    });
  });

  test("leaves non-OpenAI and gateway-backed selections unchanged", async () => {
    const model = {
      id: "anthropic/claude-opus-4.6" as const,
      authSource: "codex-subscription" as const,
    };
    const subagentModel = {
      id: "openai/gpt-5.4-mini" as const,
      authSource: "gateway" as const,
    };

    const result = await resolveAgentOptionsForStep("user-1", {
      sandbox: {
        state: { type: "vercel" },
        workingDirectory: "/workspace",
      },
      model,
      subagentModel,
    });

    expect(getUserCodexModelConfig).not.toHaveBeenCalled();
    expect(result.model).toEqual(model);
    expect(result.subagentModel).toEqual(subagentModel);
  });
});
