import { describe, expect, test } from "bun:test";
import {
  buildVariantSelectorOptions,
  getResolvedBaseModelId,
} from "./model-variant-options";
import type { ModelVariant } from "./model-variants";

describe("model variant options", () => {
  test("resolves built-in reasoning variants back to their base model", () => {
    expect(
      getResolvedBaseModelId(
        "variant:builtin:reasoning:openai__gpt-5.4:high",
        [],
      ),
    ).toBe("openai/gpt-5.4");
  });

  test("builds default, built-in, and custom variants for the selected base model", () => {
    const modelVariants: ModelVariant[] = [
      {
        id: "variant:custom-fast",
        name: "Fast",
        baseModelId: "openai/gpt-5.4",
        providerOptions: {
          reasoningEffort: "low",
        },
      },
    ];

    const options = buildVariantSelectorOptions(
      "openai/gpt-5.4",
      modelVariants,
    );

    expect(options[0]).toMatchObject({
      id: "openai/gpt-5.4",
      label: "Default",
      isDefault: true,
    });
    expect(options.map((option) => option.label)).toEqual([
      "Default",
      "Low",
      "Medium",
      "High",
      "XHigh",
      "Fast",
    ]);
  });

  test("returns empty list when no variants exist for the selected model", () => {
    expect(
      buildVariantSelectorOptions("anthropic/claude-haiku-4.5", []),
    ).toEqual([]);
  });
});
