import { describe, expect, test } from "bun:test";
import type { ModelVariant } from "@/lib/model-variants";
import {
  UnsupportedCodexModelError,
  assertCodexModelIdSupported,
  assertCodexSelectionSupported,
  getCanonicalCodexApiModelId,
  getCanonicalCodexModelId,
} from "./models";

describe("codex models", () => {
  test("normalizes legacy codex aliases to canonical supported models", () => {
    expect(getCanonicalCodexModelId("openai/gpt-5-codex")).toBe(
      "openai/gpt-5.1-codex",
    );
    expect(getCanonicalCodexModelId("codex-mini-latest")).toBe(
      "openai/gpt-5.1-codex-mini",
    );
    expect(getCanonicalCodexModelId("gpt-5.4")).toBe("openai/gpt-5.4");
    expect(getCanonicalCodexApiModelId("openai/gpt-5.3-codex")).toBe(
      "gpt-5.3-codex",
    );
    expect(getCanonicalCodexApiModelId("openai/gpt-5.3-codex-spark")).toBe(
      "gpt-5.3-codex-spark",
    );
  });

  test("rejects unsupported direct OpenAI models", () => {
    expect(() => assertCodexModelIdSupported("openai/gpt-5.3")).toThrow(
      UnsupportedCodexModelError,
    );
  });

  test("rejects variants that resolve to unsupported OpenAI models", () => {
    const variants: ModelVariant[] = [
      {
        id: "variant:unsupported-gpt-5.3",
        name: "GPT-5.3 Unsupported",
        baseModelId: "openai/gpt-5.3",
        providerOptions: {
          reasoningEffort: "high",
        },
      },
    ];

    expect(() =>
      assertCodexSelectionSupported("variant:unsupported-gpt-5.3", variants),
    ).toThrow(UnsupportedCodexModelError);
  });

  test("keeps non-OpenAI models untouched for codex validation", () => {
    expect(assertCodexSelectionSupported("anthropic/claude-sonnet-4", [])).toBe(
      "anthropic/claude-sonnet-4",
    );
  });

  test("canonicalizes supported direct OpenAI model ids", () => {
    expect(assertCodexSelectionSupported("openai/gpt-5-codex", [])).toBe(
      "openai/gpt-5.1-codex",
    );
  });
});
