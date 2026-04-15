import {
  createGateway,
  defaultSettingsMiddleware,
  gateway as aiGateway,
  wrapLanguageModel,
  type GatewayModelId,
  type JSONValue,
  type LanguageModel,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import {
  createOpenAI,
  type OpenAIResponsesProviderOptions,
} from "@ai-sdk/openai";

// Models with 4.5+ support adaptive thinking with effort control.
// Older models use the legacy extended thinking API with a budget.
function getAnthropicSettings(modelId: string): AnthropicLanguageModelOptions {
  if (modelId.includes("4.6")) {
    return {
      effort: "medium",
      thinking: { type: "adaptive" },
    } satisfies AnthropicLanguageModelOptions;
  }

  return {
    thinking: { type: "enabled", budgetTokens: 8000 },
  };
}

function isJsonObject(value: unknown): value is Record<string, JSONValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProviderOptionsRecord(
  options: Record<string, unknown>,
): Record<string, JSONValue> {
  return options as Record<string, JSONValue>;
}

function mergeRecords(
  base: Record<string, JSONValue>,
  override: Record<string, JSONValue>,
): Record<string, JSONValue> {
  const merged: Record<string, JSONValue> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existingValue = merged[key];

    if (isJsonObject(existingValue) && isJsonObject(value)) {
      merged[key] = mergeRecords(existingValue, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

export type ProviderOptionsByProvider = Record<
  string,
  Record<string, JSONValue>
>;

export function mergeProviderOptions(
  defaults: ProviderOptionsByProvider,
  overrides?: ProviderOptionsByProvider,
): ProviderOptionsByProvider {
  if (!overrides || Object.keys(overrides).length === 0) {
    return defaults;
  }

  const merged: ProviderOptionsByProvider = { ...defaults };

  for (const [provider, providerOverrides] of Object.entries(overrides)) {
    const providerDefaults = merged[provider];

    if (!providerDefaults) {
      merged[provider] = providerOverrides;
      continue;
    }

    merged[provider] = mergeRecords(providerDefaults, providerOverrides);
  }

  return merged;
}

export interface GatewayTransportConfig {
  baseURL: string;
  apiKey: string;
}

export interface OpenAICompatibleConfig {
  kind: "openai-compatible";
  baseURL: string;
  apiKey: string;
  headers?: Record<string, string>;
  name?: string;
  fetch?: FetchFunction;
}

export type GatewayConfig = GatewayTransportConfig | OpenAICompatibleConfig;

export interface GatewayOptions {
  devtools?: boolean;
  config?: GatewayConfig;
  providerOptionsOverrides?: ProviderOptionsByProvider;
}

export type { GatewayModelId, LanguageModel, JSONValue };

type WrappedLanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];

function isOpenAICompatibleConfig(
  config: GatewayConfig,
): config is OpenAICompatibleConfig {
  return "kind" in config && config.kind === "openai-compatible";
}

function normalizeOpenAICompatibleModelId(modelId: string): string {
  return modelId.startsWith("openai/")
    ? modelId.slice("openai/".length)
    : modelId;
}

export function shouldApplyOpenAIReasoningDefaults(modelId: string): boolean {
  return (
    modelId.startsWith("openai/gpt-5") && !isOpenAICodexSparkModel(modelId)
  );
}

function shouldApplyOpenAITextVerbosityDefaults(modelId: string): boolean {
  return modelId.startsWith("openai/gpt-5.4");
}

function isOpenAICodexSparkModel(modelId: string): boolean {
  return modelId.startsWith("openai/gpt-5.3-codex-spark");
}

export function getProviderOptionsForModel(
  modelId: string,
  providerOptionsOverrides?: ProviderOptionsByProvider,
): ProviderOptionsByProvider {
  const defaultProviderOptions: ProviderOptionsByProvider = {};

  // Apply anthropic defaults
  if (modelId.startsWith("anthropic/")) {
    defaultProviderOptions.anthropic = toProviderOptionsRecord(
      getAnthropicSettings(modelId),
    );
  }

  // OpenAI model responses should never be persisted.
  if (modelId.startsWith("openai/")) {
    defaultProviderOptions.openai = toProviderOptionsRecord({
      store: false,
    } satisfies OpenAIResponsesProviderOptions);
  }

  // Apply OpenAI defaults for GPT-5 variants to expose encrypted reasoning content.
  // This avoids Responses API failures when `store: false`, e.g.:
  // "Item with id 'rs_...' not found. Items are not persisted when `store` is set to false."
  if (shouldApplyOpenAIReasoningDefaults(modelId)) {
    defaultProviderOptions.openai = mergeRecords(
      defaultProviderOptions.openai ?? {},
      toProviderOptionsRecord({
        reasoningSummary: "detailed",
        include: ["reasoning.encrypted_content"],
      } satisfies OpenAIResponsesProviderOptions),
    );
  }

  if (modelId.startsWith("openai/gpt-5")) {
    defaultProviderOptions.openai = mergeRecords(
      defaultProviderOptions.openai ?? {},
      toProviderOptionsRecord({
        include: ["reasoning.encrypted_content"],
      } satisfies OpenAIResponsesProviderOptions),
    );
  }

  if (shouldApplyOpenAITextVerbosityDefaults(modelId)) {
    defaultProviderOptions.openai = mergeRecords(
      defaultProviderOptions.openai ?? {},
      toProviderOptionsRecord({
        textVerbosity: "low",
      } satisfies OpenAIResponsesProviderOptions),
    );
  }

  const providerOptions = mergeProviderOptions(
    defaultProviderOptions,
    providerOptionsOverrides,
  );

  // Enforce OpenAI non-persistence even when custom provider overrides are present.
  if (modelId.startsWith("openai/")) {
    providerOptions.openai = mergeRecords(
      providerOptions.openai ?? {},
      toProviderOptionsRecord({
        store: false,
      } satisfies OpenAIResponsesProviderOptions),
    );
  }

  return providerOptions;
}

export function gateway(
  modelId: GatewayModelId,
  options: GatewayOptions = {},
): WrappedLanguageModel {
  const { devtools = false, config, providerOptionsOverrides } = options;

  let model: WrappedLanguageModel;

  if (config && isOpenAICompatibleConfig(config)) {
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      fetch: config.fetch,
      headers: config.headers,
      ...(config.name ? { name: config.name } : {}),
    });
    model = provider.responses(normalizeOpenAICompatibleModelId(modelId));
  } else {
    const baseGateway = config
      ? createGateway({ baseURL: config.baseURL, apiKey: config.apiKey })
      : aiGateway;
    model = baseGateway(modelId) as WrappedLanguageModel;
  }

  const providerOptions = getProviderOptionsForModel(
    modelId,
    providerOptionsOverrides,
  );

  if (Object.keys(providerOptions).length > 0) {
    model = wrapLanguageModel({
      model,
      middleware: defaultSettingsMiddleware({
        settings: { providerOptions },
      }),
    });
  }

  // Apply devtools middleware if requested
  if (devtools) {
    model = wrapLanguageModel({ model, middleware: devToolsMiddleware() });
  }

  return model;
}
