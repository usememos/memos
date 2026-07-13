import { useQuery } from "@tanstack/react-query";
import { identityProviderServiceClient } from "@/connect";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service_pb";

// Query keys factory
export const identityProviderKeys = {
  all: ["identityProviders"] as const,
  list: () => [...identityProviderKeys.all, "list"] as const,
};

const EMPTY_LIST: IdentityProvider[] = [];

// Hook to fetch the configured identity providers. Pass `enabled: false` on
// pages/branches that never render provider buttons to skip the request.
export function useIdentityProviderList(enabled = true): IdentityProvider[] {
  const { data } = useQuery({
    queryKey: identityProviderKeys.list(),
    queryFn: async () => (await identityProviderServiceClient.listIdentityProviders({})).identityProviders,
    staleTime: 60_000,
    enabled,
  });
  return data ?? EMPTY_LIST;
}
