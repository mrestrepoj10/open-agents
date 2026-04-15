import type { FetchFunction } from "@ai-sdk/provider-utils";
import {
  assertCodexModelIdSupported,
  getCanonicalCodexApiModelId,
} from "./models";

const DEFAULT_CODEX_INSTRUCTIONS =
  "You are Codex, a coding assistant operating inside Open Harness. Follow developer and user instructions, use available tools carefully, and produce concise, accurate results.";

type CodexRequestBody = {
  model?: string;
  instructions?: string;
  input?: Array<Record<string, unknown>>;
  include?: string[];
  store?: boolean;
  max_output_tokens?: number;
  max_completion_tokens?: number;
  [key: string]: unknown;
};

function normalizeCodexModel(model: string | undefined): string {
  if (!model) {
    return "gpt-5.1-codex-max";
  }

  const canonicalModelId = assertCodexModelIdSupported(model);
  return getCanonicalCodexApiModelId(canonicalModelId) ?? "gpt-5.1-codex-max";
}

function stripInputIds(
  input: CodexRequestBody["input"],
): CodexRequestBody["input"] {
  if (!Array.isArray(input)) {
    return input;
  }

  return input.map((item) => {
    if ("id" in item) {
      const { id: _id, ...rest } = item;
      return rest;
    }

    return item;
  });
}

function extractTextContent(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }

    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    if ("text" in entry && typeof entry.text === "string") {
      return [entry.text];
    }

    return [];
  });
}

function extractInstructionsFromInput(
  input: CodexRequestBody["input"],
): string | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const instructionParts = input.flatMap((item) => {
    const role = typeof item.role === "string" ? item.role : null;
    if (role !== "system" && role !== "developer") {
      return [];
    }

    return extractTextContent(item.content);
  });

  const combined = instructionParts.join("\n\n").trim();
  return combined.length > 0 ? combined : null;
}

function ensureInclude(include: unknown): string[] {
  const values = Array.isArray(include)
    ? include.filter((value): value is string => typeof value === "string")
    : [];

  if (values.includes("reasoning.encrypted_content")) {
    return values;
  }

  return [...values, "reasoning.encrypted_content"];
}

export function transformCodexRequestBody(body: CodexRequestBody) {
  const normalizedModel = normalizeCodexModel(body.model);
  const instructions =
    (typeof body.instructions === "string" && body.instructions.trim()) ||
    extractInstructionsFromInput(body.input) ||
    DEFAULT_CODEX_INSTRUCTIONS;

  return {
    body: {
      ...body,
      model: normalizedModel,
      store: false,
      instructions,
      input: stripInputIds(body.input),
      include: ensureInclude(body.include),
      max_output_tokens: undefined,
      max_completion_tokens: undefined,
    } satisfies CodexRequestBody,
    normalizedModel,
  };
}

export function createCodexFetch(): FetchFunction {
  return (async (input, init) => {
    if (!init?.body || typeof init.body !== "string") {
      return fetch(input, init);
    }

    try {
      const parsedBody = JSON.parse(init.body) as CodexRequestBody;
      const { body, normalizedModel } = transformCodexRequestBody(parsedBody);

      if (body.model !== parsedBody.model) {
        console.info("[codex] Normalized request model", {
          originalModel: parsedBody.model ?? null,
          normalizedModel,
        });
      }

      return fetch(input, {
        ...init,
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("[codex] Failed to transform request body", error);
      throw error;
    }
  }) as FetchFunction;
}
