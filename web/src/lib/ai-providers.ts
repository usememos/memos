import { InstanceSetting_AIProviderType } from "@/types/proto/api/v1/instance_service_pb";

/**
 * Provider types the settings dialog offers. OpenRouter and DeepInfra speak the
 * OpenAI wire protocol, so they share the OpenAI implementation and differ only
 * in endpoint and model catalog.
 */
export const AI_PROVIDER_TYPE_OPTIONS = [
  InstanceSetting_AIProviderType.OPENAI,
  InstanceSetting_AIProviderType.OPENROUTER,
  InstanceSetting_AIProviderType.DEEPINFRA,
  InstanceSetting_AIProviderType.GEMINI,
] as const;

/** The provider types the AI Hub can chat with. */
export const CHAT_CAPABLE_PROVIDER_TYPES: readonly InstanceSetting_AIProviderType[] = [
  InstanceSetting_AIProviderType.OPENAI,
  InstanceSetting_AIProviderType.OPENROUTER,
  InstanceSetting_AIProviderType.DEEPINFRA,
];

/** Provider types implemented by the transcription service. */
export const TRANSCRIPTION_CAPABLE_PROVIDER_TYPES: readonly InstanceSetting_AIProviderType[] = [
  InstanceSetting_AIProviderType.OPENAI,
  InstanceSetting_AIProviderType.GEMINI,
];

/**
 * Mirrors the server's DefaultChatContextBudgetTokens. Shown as the budget
 * input's placeholder so the effective default is visible when unset.
 */
export const DEFAULT_CHAT_CONTEXT_BUDGET_TOKENS = 32000;

const DEFAULT_ENDPOINTS: Partial<Record<InstanceSetting_AIProviderType, string>> = {
  [InstanceSetting_AIProviderType.OPENAI]: "https://api.openai.com/v1",
  [InstanceSetting_AIProviderType.OPENROUTER]: "https://openrouter.ai/api/v1",
  [InstanceSetting_AIProviderType.DEEPINFRA]: "https://api.deepinfra.com/v1/openai",
  [InstanceSetting_AIProviderType.GEMINI]: "https://generativelanguage.googleapis.com/v1beta",
};

/** The enum name, used when no friendly label is available. */
export const getProviderTypeLabel = (type: InstanceSetting_AIProviderType): string => {
  return InstanceSetting_AIProviderType[type] ?? "UNKNOWN";
};

/** The canonical base URL for a provider type, shown as an input placeholder. */
export const getDefaultEndpointPlaceholder = (type: InstanceSetting_AIProviderType): string => DEFAULT_ENDPOINTS[type] ?? "";

/** Whether the AI Hub can run chat completions against this provider type. */
export const isChatCapableProviderType = (type: InstanceSetting_AIProviderType): boolean => CHAT_CAPABLE_PROVIDER_TYPES.includes(type);

/** Whether audio transcription is implemented for this provider type. */
export const isTranscriptionCapableProviderType = (type: InstanceSetting_AIProviderType): boolean =>
  TRANSCRIPTION_CAPABLE_PROVIDER_TYPES.includes(type);
