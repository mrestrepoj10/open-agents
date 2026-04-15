import {
  MODEL_VARIANT_ID_PREFIX,
  resolveModelSelection,
  type ModelVariant,
} from "@/lib/model-variants";

const CODEX_SUPPORTED_MODELS = [
  {
    id: "openai/gpt-5.4",
    apiModelId: "gpt-5.4",
    label: "GPT-5.4",
  },
  {
    id: "openai/gpt-5.4-mini",
    apiModelId: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
  },
  {
    id: "openai/gpt-5.3-codex",
    apiModelId: "gpt-5.3-codex",
    label: "GPT-5.3-Codex",
  },
  {
    id: "openai/gpt-5.3-codex-spark",
    apiModelId: "gpt-5.3-codex-spark",
    label: "GPT-5.3-Codex-Spark",
  },
  {
    id: "openai/gpt-5.2",
    apiModelId: "gpt-5.2",
    label: "GPT-5.2",
  },
  {
    id: "openai/gpt-5.2-codex",
    apiModelId: "gpt-5.2-codex",
    label: "GPT-5.2-Codex",
  },
  {
    id: "openai/gpt-5.1-codex-max",
    apiModelId: "gpt-5.1-codex-max",
    label: "GPT-5.1-Codex-Max",
  },
  {
    id: "openai/gpt-5.1-codex",
    apiModelId: "gpt-5.1-codex",
    label: "GPT-5.1-Codex",
  },
  {
    id: "openai/gpt-5.1-codex-mini",
    apiModelId: "gpt-5.1-codex-mini",
    label: "GPT-5.1-Codex-Mini",
  },
] as const;

type CodexSupportedModel = (typeof CODEX_SUPPORTED_MODELS)[number];
type CodexSupportedModelId = CodexSupportedModel["id"];

const CODEX_SUPPORTED_MODEL_IDS = CODEX_SUPPORTED_MODELS.map(
  (model) => model.id,
);

const CODEX_MODEL_ALIASES = new Map<string, CodexSupportedModelId>([
  ["openai/gpt-5.4", "openai/gpt-5.4"],
  ["gpt-5.4", "openai/gpt-5.4"],
  ["openai/gpt-5.4-mini", "openai/gpt-5.4-mini"],
  ["gpt-5.4-mini", "openai/gpt-5.4-mini"],
  ["openai/gpt-5.2", "openai/gpt-5.2"],
  ["gpt-5.2", "openai/gpt-5.2"],
  ["openai/gpt-5.3-codex", "openai/gpt-5.3-codex"],
  ["gpt-5.3-codex", "openai/gpt-5.3-codex"],
  ["openai/gpt-5.3-codex-spark", "openai/gpt-5.3-codex-spark"],
  ["gpt-5.3-codex-spark", "openai/gpt-5.3-codex-spark"],
  ["openai/gpt-5.2-codex", "openai/gpt-5.2-codex"],
  ["gpt-5.2-codex", "openai/gpt-5.2-codex"],
  ["openai/gpt-5.1-codex-max", "openai/gpt-5.1-codex-max"],
  ["gpt-5.1-codex-max", "openai/gpt-5.1-codex-max"],
  ["openai/gpt-5.1-codex", "openai/gpt-5.1-codex"],
  ["gpt-5.1-codex", "openai/gpt-5.1-codex"],
  ["openai/gpt-5-codex", "openai/gpt-5.1-codex"],
  ["gpt-5-codex", "openai/gpt-5.1-codex"],
  ["openai/gpt-5.1-codex-mini", "openai/gpt-5.1-codex-mini"],
  ["gpt-5.1-codex-mini", "openai/gpt-5.1-codex-mini"],
  ["openai/gpt-5-codex-mini", "openai/gpt-5.1-codex-mini"],
  ["gpt-5-codex-mini", "openai/gpt-5.1-codex-mini"],
  ["openai/codex-mini-latest", "openai/gpt-5.1-codex-mini"],
  ["codex-mini-latest", "openai/gpt-5.1-codex-mini"],
]);

function formatSupportedCodexModels(): string {
  return CODEX_SUPPORTED_MODELS.map((model) => model.id).join(", ");
}

export class UnsupportedCodexModelError extends Error {
  requestedModelId: string;
  resolvedModelId?: string;

  constructor(params: { requestedModelId: string; resolvedModelId?: string }) {
    const { requestedModelId, resolvedModelId } = params;
    const modelDescription =
      resolvedModelId && resolvedModelId !== requestedModelId
        ? `"${requestedModelId}" resolves to unsupported model "${resolvedModelId}"`
        : `Model "${requestedModelId}"`;

    super(
      `${modelDescription} is not supported by Codex Subscription. Supported models: ${formatSupportedCodexModels()}.`,
    );
    this.name = "UnsupportedCodexModelError";
    this.requestedModelId = requestedModelId;
    this.resolvedModelId = resolvedModelId;
  }
}

export function getSupportedCodexModelIds(): readonly CodexSupportedModelId[] {
  return CODEX_SUPPORTED_MODEL_IDS;
}

export function getSupportedCodexModels(): readonly CodexSupportedModel[] {
  return CODEX_SUPPORTED_MODELS;
}

export function getSupportedCodexModelSummary(): string {
  return formatSupportedCodexModels();
}

export function isUnsupportedCodexModelError(
  error: unknown,
): error is UnsupportedCodexModelError {
  return error instanceof UnsupportedCodexModelError;
}

export function getSupportedCodexApiModelIds(): readonly string[] {
  return CODEX_SUPPORTED_MODELS.map((model) => model.apiModelId);
}

export function getCanonicalCodexModelId(
  modelId: string | null | undefined,
): CodexSupportedModelId | null {
  if (!modelId) {
    return null;
  }

  return CODEX_MODEL_ALIASES.get(modelId.trim().toLowerCase()) ?? null;
}

export function isCodexSupportedModelId(
  modelId: string | null | undefined,
): boolean {
  return getCanonicalCodexModelId(modelId) !== null;
}

export function getCanonicalCodexApiModelId(
  modelId: string | null | undefined,
): string | null {
  const canonicalModelId = getCanonicalCodexModelId(modelId);
  if (!canonicalModelId) {
    return null;
  }

  return (
    CODEX_SUPPORTED_MODELS.find((model) => model.id === canonicalModelId)
      ?.apiModelId ?? null
  );
}

export function assertCodexModelIdSupported(
  modelId: string | null | undefined,
): CodexSupportedModelId | null {
  if (!modelId) {
    return null;
  }

  const canonicalModelId = getCanonicalCodexModelId(modelId);
  if (!canonicalModelId) {
    throw new UnsupportedCodexModelError({ requestedModelId: modelId });
  }

  return canonicalModelId;
}

export function assertCodexSelectionSupported(
  selectedModelId: string | null | undefined,
  modelVariants: ModelVariant[],
): string | null | undefined {
  if (!selectedModelId) {
    return selectedModelId;
  }

  const selection = selectedModelId.startsWith(MODEL_VARIANT_ID_PREFIX)
    ? resolveModelSelection(selectedModelId, modelVariants)
    : {
        resolvedModelId: selectedModelId,
        isMissingVariant: false,
      };

  if (selection.isMissingVariant) {
    return selectedModelId;
  }

  if (!selection.resolvedModelId.startsWith("openai/")) {
    return selectedModelId;
  }

  const canonicalResolvedModelId = getCanonicalCodexModelId(
    selection.resolvedModelId,
  );
  if (!canonicalResolvedModelId) {
    throw new UnsupportedCodexModelError({
      requestedModelId: selectedModelId,
      resolvedModelId: selection.resolvedModelId,
    });
  }

  if (selectedModelId.startsWith(MODEL_VARIANT_ID_PREFIX)) {
    return selectedModelId;
  }

  return canonicalResolvedModelId;
}
