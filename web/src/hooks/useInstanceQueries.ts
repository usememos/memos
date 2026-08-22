import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instanceServiceClient } from "@/connect";
import { InstanceSetting, InstanceSetting_AccessSetting, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";

// Query keys factory
export const instanceKeys = {
  all: ["instance"] as const,
  profile: () => [...instanceKeys.all, "profile"] as const,
  settings: () => [...instanceKeys.all, "settings"] as const,
  setting: (key: InstanceSetting_Key) => [...instanceKeys.settings(), key] as const,
  settingsBatch: (keys: InstanceSetting_Key[]) => [...instanceKeys.settings(), "batch", ...keys] as const,
  stats: () => [...instanceKeys.all, "stats"] as const,
};

// Build setting name from key
const buildInstanceSettingName = (key: InstanceSetting_Key): string => {
  const keyName = InstanceSetting_Key[key];
  return `instance/settings/${keyName}`;
};

// Hook to fetch instance resource statistics. Admin only on the server side.
export function useInstanceStats() {
  return useQuery({
    queryKey: instanceKeys.stats(),
    queryFn: () => instanceServiceClient.getInstanceStats({}),
    staleTime: 60_000, // 60s — matches server-side cache TTL
  });
}

// Hook to fetch instance profile
export function useInstanceProfile() {
  return useQuery({
    queryKey: instanceKeys.profile(),
    queryFn: async () => {
      const profile = await instanceServiceClient.getInstanceProfile({});
      return profile;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - instance profile rarely changes
  });
}

// Hook to fetch a specific instance setting
export function useInstanceSetting(key: InstanceSetting_Key) {
  return useQuery({
    queryKey: instanceKeys.setting(key),
    queryFn: async () => {
      const setting = await instanceServiceClient.getInstanceSetting({
        name: buildInstanceSettingName(key),
      });
      return setting;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to fetch multiple instance settings
export function useInstanceSettings(keys: InstanceSetting_Key[]) {
  return useQuery({
    queryKey: instanceKeys.settingsBatch(keys),
    queryFn: async () => {
      const response = await instanceServiceClient.batchGetInstanceSettings({
        names: keys.map(buildInstanceSettingName),
      });
      return response.settings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to update instance setting
export function useUpdateInstanceSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (setting: InstanceSetting) => instanceServiceClient.updateInstanceSetting({ setting }),
    onSuccess: async (setting) => {
      // Update the exact setting cache from the server response. Batch caches
      // are marked stale without refetching so an active setting query does not
      // issue a duplicate request immediately after a successful mutation.
      const keyMatch = setting.name.match(/instance\/settings\/(\w+)/);
      if (keyMatch) {
        const keyName = keyMatch[1] as keyof typeof InstanceSetting_Key;
        const key = InstanceSetting_Key[keyName];
        if (key !== undefined) {
          await queryClient.cancelQueries({ queryKey: instanceKeys.setting(key), exact: true });
          queryClient.setQueryData(instanceKeys.setting(key), setting);
        }
      }
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "instance" && query.queryKey[1] === "settings" && query.queryKey[2] === "batch",
        refetchType: "none",
      });
    },
  });
}

// Derived hooks for common settings
export function useAccessSetting() {
  const { data: setting, ...rest } = useInstanceSetting(InstanceSetting_Key.ACCESS);
  const accessSetting: InstanceSetting_AccessSetting | undefined =
    setting?.value.case === "accessSetting" ? setting.value.value : undefined;
  return { data: accessSetting, ...rest };
}

export function useGeneralSetting() {
  const { data: setting, ...rest } = useInstanceSetting(InstanceSetting_Key.GENERAL);
  const generalSetting = setting?.value.case === "generalSetting" ? setting.value.value : undefined;
  return { data: generalSetting, ...rest };
}

export function useMemoRelatedSetting() {
  const { data: setting, ...rest } = useInstanceSetting(InstanceSetting_Key.MEMO_RELATED);
  const memoRelatedSetting = setting?.value.case === "memoRelatedSetting" ? setting.value.value : undefined;
  return { data: memoRelatedSetting, ...rest };
}
