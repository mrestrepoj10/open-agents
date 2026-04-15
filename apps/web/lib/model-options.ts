import {
  APP_DEFAULT_MODEL_ID,
  type AvailableModel,
  type AvailableModelCost,
  getModelDisplayName,
} from "@/lib/models";
import {
  MODEL_VARIANT_ID_PREFIX,
  type ModelVariant,
} from "@/lib/model-variants";
import { getSupportedCodexModels } from "@/lib/codex/models";

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
  isVariant: boolean;
  provider?: string;
  contextWindow?: number;
  cost?: AvailableModelCost;
}

function toBaseModelOption(model: AvailableModel): ModelOption {
  return {
    id: model.id,
    label: getModelDisplayName(model),
    description: model.description ?? undefined,
    isVariant: false,
    provider: model.id.split("/")[0],
    contextWindow: model.context_window,
    ...(model.cost ? { cost: model.cost } : {}),
  };
}

function toVariantOption(
  variant: ModelVariant,
  baseModel?: AvailableModel,
): ModelOption {
  const baseLabel = baseModel
    ? getModelDisplayName(baseModel)
    : variant.baseModelId;

  return {
    id: variant.id,
    label: variant.name,
    description: `Variant of ${baseLabel}`,
    isVariant: true,
    provider: variant.baseModelId.split("/")[0],
    contextWindow: baseModel?.context_window,
    ...(baseModel?.cost ? { cost: baseModel.cost } : {}),
  };
}

export function buildModelOptions(
  models: AvailableModel[],
  modelVariants: ModelVariant[],
): ModelOption[] {
  const baseModelOptions = models.map(toBaseModelOption);
  const baseModelsById = new Map(models.map((model) => [model.id, model]));

  const variantOptions = modelVariants.map((variant) =>
    toVariantOption(variant, baseModelsById.get(variant.baseModelId)),
  );

  return [...baseModelOptions, ...variantOptions];
}

export function buildSessionChatModelOptions(
  models: AvailableModel[],
  modelVariants: ModelVariant[],
): ModelOption[] {
  return buildModelOptions(models, modelVariants);
}

export function withMissingModelOption(
  modelOptions: ModelOption[],
  modelId: string | null | undefined,
): ModelOption[] {
  if (!modelId || modelOptions.some((option) => option.id === modelId)) {
    return modelOptions;
  }

  if (!modelId.startsWith(MODEL_VARIANT_ID_PREFIX)) {
    return modelOptions;
  }

  const label = `${modelId.slice(MODEL_VARIANT_ID_PREFIX.length)} (missing)`;

  return [
    ...modelOptions,
    {
      id: modelId,
      label,
      description: "Variant no longer exists",
      isVariant: true,
      contextWindow: undefined,
    },
  ];
}

export function getDefaultModelOptionId(modelOptions: ModelOption[]): string {
  if (modelOptions.some((option) => option.id === APP_DEFAULT_MODEL_ID)) {
    return APP_DEFAULT_MODEL_ID;
  }

  return modelOptions[0]?.id ?? APP_DEFAULT_MODEL_ID;
}

export function prioritizeModelOptionsByProvider(
  modelOptions: ModelOption[],
  provider: string,
): ModelOption[] {
  const prioritized = modelOptions.filter(
    (option) => option.provider === provider,
  );
  if (prioritized.length === 0) {
    return modelOptions;
  }

  const remaining = modelOptions.filter(
    (option) => option.provider !== provider,
  );
  return [...prioritized, ...remaining];
}

const CODEX_TAB_DESCRIPTION = "Codex-ready model";
const CODEX_TAB_MODEL_IDS = [
  "openai/gpt-5.4",
  "openai/gpt-5.2-codex",
  "openai/gpt-5.1-codex-max",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.3-codex",
  "openai/gpt-5.3-codex-spark",
  "openai/gpt-5.2",
  "openai/gpt-5.1-codex-mini",
] as const;

function createFallbackCodexModelOption(input: {
  id: string;
  label: string;
}): ModelOption {
  return {
    id: input.id,
    label: input.label,
    description: CODEX_TAB_DESCRIPTION,
    isVariant: false,
    provider: "openai",
  };
}

export function buildCodexTabModelOptions(
  modelOptions: ModelOption[],
): ModelOption[] {
  const optionsById = new Map(
    modelOptions.map((option) => [option.id, option]),
  );
  const supportedCodexModels = new Map(
    getSupportedCodexModels().map((model) => [model.id, model]),
  );

  return CODEX_TAB_MODEL_IDS.flatMap((modelId) => {
    const existingOption = optionsById.get(modelId);
    if (existingOption) {
      return [existingOption];
    }

    const supportedCodexModel = supportedCodexModels.get(modelId);
    if (!supportedCodexModel) {
      return [];
    }

    return [createFallbackCodexModelOption(supportedCodexModel)];
  });
}
