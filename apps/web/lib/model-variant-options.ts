import {
  getBuiltInReasoningVariantsForBaseModel,
  resolveModelSelection,
  type ModelVariant,
} from "@/lib/model-variants";

export interface VariantSelectorOption {
  id: string;
  label: string;
  description?: string;
  isDefault: boolean;
  isBuiltIn: boolean;
}

export function getResolvedBaseModelId(
  selectedModelId: string | null | undefined,
  modelVariants: ModelVariant[],
): string | null {
  if (!selectedModelId) {
    return null;
  }

  return resolveModelSelection(selectedModelId, modelVariants).resolvedModelId;
}

export function buildVariantSelectorOptions(
  selectedModelId: string | null | undefined,
  modelVariants: ModelVariant[],
): VariantSelectorOption[] {
  const baseModelId = getResolvedBaseModelId(selectedModelId, modelVariants);
  if (!baseModelId) {
    return [];
  }

  const builtInVariants = getBuiltInReasoningVariantsForBaseModel(baseModelId);
  const customVariants = modelVariants.filter(
    (variant) => variant.baseModelId === baseModelId,
  );
  const allVariants = [...builtInVariants, ...customVariants];

  if (allVariants.length === 0) {
    return [];
  }

  return [
    {
      id: baseModelId,
      label: "Default",
      description: "Use the model default reasoning settings",
      isDefault: true,
      isBuiltIn: true,
    },
    ...allVariants.map((variant) => ({
      id: variant.id,
      label: variant.name,
      description: variant.id,
      isDefault: false,
      isBuiltIn: variant.id.startsWith("variant:builtin:"),
    })),
  ];
}
