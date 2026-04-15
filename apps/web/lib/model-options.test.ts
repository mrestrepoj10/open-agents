import { describe, expect, test } from "bun:test";
import type { ModelVariant } from "@/lib/model-variants";
import {
  buildCodexTabModelOptions,
  buildModelOptions,
  getDefaultModelOptionId,
  prioritizeModelOptionsByProvider,
  withMissingModelOption,
} from "./model-options";
import type { AvailableModel } from "./models";

function createModel(input: {
  id: string;
  name?: string;
  description?: string | null;
  contextWindow?: number;
}): AvailableModel {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    context_window: input.contextWindow,
    modelType: "language",
  } as unknown as AvailableModel;
}

describe("model options", () => {
  test("buildModelOptions includes base models and variants", () => {
    const models: AvailableModel[] = [
      createModel({
        id: "openai/gpt-5",
        name: "GPT-5",
        description: "Base model",
        contextWindow: 400_000,
      }),
    ];

    const variants: ModelVariant[] = [
      {
        id: "variant:gpt-5-medium",
        name: "GPT-5 Medium Reasoning",
        baseModelId: "openai/gpt-5",
        providerOptions: { reasoningEffort: "medium" },
      },
    ];

    const options = buildModelOptions(models, variants);

    expect(options).toEqual([
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        description: "Base model",
        isVariant: false,
        provider: "openai",
        contextWindow: 400_000,
      },
      {
        id: "variant:gpt-5-medium",
        label: "GPT-5 Medium Reasoning",
        description: "Variant of GPT-5",
        isVariant: true,
        provider: "openai",
        contextWindow: 400_000,
      },
    ]);
  });

  test("withMissingModelOption appends missing variant option", () => {
    const result = withMissingModelOption([], "variant:removed");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "variant:removed",
      label: "removed (missing)",
      description: "Variant no longer exists",
      isVariant: true,
      contextWindow: undefined,
    });
  });

  test("withMissingModelOption does not append non-variant ids", () => {
    const original = [
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        isVariant: false,
      },
    ];

    expect(withMissingModelOption(original, "openai/unknown-model")).toBe(
      original,
    );
  });

  test("withMissingModelOption returns original list when id already exists", () => {
    const original = [
      {
        id: "variant:existing",
        label: "Existing Variant",
        isVariant: true,
      },
    ];

    expect(withMissingModelOption(original, "variant:existing")).toBe(original);
  });

  test("getDefaultModelOptionId prefers repository default model when present", () => {
    const options = [
      {
        id: "openai/gpt-5.4",
        label: "GPT-5.4",
        isVariant: false,
      },
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        isVariant: false,
      },
    ];

    expect(getDefaultModelOptionId(options)).toBe("openai/gpt-5.4");
  });

  test("getDefaultModelOptionId falls back to first option when default is missing", () => {
    const options = [
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        isVariant: false,
      },
    ];

    expect(getDefaultModelOptionId(options)).toBe("openai/gpt-5");
  });

  test("prioritizeModelOptionsByProvider moves matching provider models to the front", () => {
    const options = [
      {
        id: "anthropic/claude-opus-4.6",
        label: "Claude Opus 4.6",
        isVariant: false,
        provider: "anthropic",
      },
      {
        id: "openai/gpt-5.4",
        label: "GPT-5.4",
        isVariant: false,
        provider: "openai",
      },
      {
        id: "variant:openai-high",
        label: "GPT-5.4 High",
        isVariant: true,
        provider: "openai",
      },
      {
        id: "google/gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        isVariant: false,
        provider: "google",
      },
    ];

    expect(prioritizeModelOptionsByProvider(options, "openai")).toEqual([
      options[1],
      options[2],
      options[0],
      options[3],
    ]);
  });

  test("buildCodexTabModelOptions returns the curated codex models in the requested order", () => {
    const options = buildCodexTabModelOptions([
      {
        id: "openai/gpt-5.2-codex",
        label: "GPT-5.2-Codex",
        isVariant: false,
        provider: "openai",
      },
      {
        id: "openai/gpt-5.4",
        label: "GPT-5.4",
        isVariant: false,
        provider: "openai",
      },
    ]);

    expect(options.map((option) => option.id)).toEqual([
      "openai/gpt-5.4",
      "openai/gpt-5.2-codex",
      "openai/gpt-5.1-codex-max",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.3-codex",
      "openai/gpt-5.3-codex-spark",
      "openai/gpt-5.2",
      "openai/gpt-5.1-codex-mini",
    ]);
    expect(options[5]).toMatchObject({
      id: "openai/gpt-5.3-codex-spark",
      label: "GPT-5.3-Codex-Spark",
      description: "Codex-ready model",
    });
  });
});
