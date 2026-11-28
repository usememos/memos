import { useQuery } from "@tanstack/react-query";
import { aiServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { AIProviderTypeInfo } from "@/types/proto/api/ai_service_pb";
import type { InstanceSetting_AIProviderType } from "@/types/proto/api/instance_service_pb";
import { isSuperUser } from "@/utils/user";

/** The parts of a saved provider that decide what its model listing returns. */
export interface ProviderConnection {
  id: string;
  type: InstanceSetting_AIProviderType;
  endpoint: string;
  apiKeyHint: string;
}

export const aiKeys = {
  providerTypes: ["aiProviderTypes"] as const,
  providerModels: (provider: ProviderConnection) =>
    ["aiProviderModels", provider.id, provider.type, provider.endpoint, provider.apiKeyHint] as const,
};

// The provider types this server supports. Fixed for the life of the server, and administrator-only.
export function useAIProviderTypes(): AIProviderTypeInfo[] {
  const currentUser = useCurrentUser();
  const { data } = useQuery({
    queryKey: aiKeys.providerTypes,
    queryFn: async () => (await aiServiceClient.listAIProviderTypes({})).providerTypes,
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !!isSuperUser(currentUser),
  });
  return data ?? [];
}

// The models a saved provider reports. The listing is also the provider's health check, so a
// failure is kept as the query's error rather than retried. Changing the provider's connection
// changes the key, so a saved edit lists again.
export function useAIProviderModels(provider: ProviderConnection | undefined) {
  return useQuery({
    queryKey: provider ? aiKeys.providerModels(provider) : ["aiProviderModels", "none"],
    queryFn: async () => (await aiServiceClient.listAIProviderModels({ providerId: provider?.id ?? "" })).models,
    enabled: !!provider,
    retry: false,
    // Each status and model field observes the same listing: a failed one is not asked again per field.
    retryOnMount: false,
    staleTime: 5 * 60 * 1000,
  });
}
