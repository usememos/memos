import { useQuery } from "@tanstack/react-query";
import { instanceServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { ConfigurationStatus, ConfigurationStatus_ManagedResource } from "@/types/proto/api/instance_service_pb";
import { isSuperUser } from "@/utils/user";

export const configurationKeys = {
  status: ["configurationStatus"] as const,
};

// What declarative configuration manages. Only administrators can read it, and
// they read it once per session; the server enforces ownership either way.
export function useConfigurationStatus() {
  const currentUser = useCurrentUser();
  const { data } = useQuery({
    queryKey: configurationKeys.status,
    queryFn: () => instanceServiceClient.getConfigurationStatus({}),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !!isSuperUser(currentUser),
  });
  return data;
}

// The managed resource with name in status, or undefined when configuration does not manage it.
export function findManagedResource(
  status: ConfigurationStatus | undefined,
  name: string,
): ConfigurationStatus_ManagedResource | undefined {
  return status?.managedResources.find((resource) => resource.resource === name);
}

// The managed resource with name, or undefined when configuration does not manage it.
export function useManagedResource(name: string): ConfigurationStatus_ManagedResource | undefined {
  return findManagedResource(useConfigurationStatus(), name);
}

const covers = (fields: string[], path: string) =>
  fields.some((field) => field === "*" || path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[`));

// Whether the API refuses a change to path, a JSON-name field path such as
// generalSetting.customProfile, because configuration manages it.
export function isFieldManaged(resource: ConfigurationStatus_ManagedResource | undefined, path: string): boolean {
  if (!resource) {
    return false;
  }
  return covers(resource.managedFields, path) && !covers(resource.ignoredFields, path);
}
