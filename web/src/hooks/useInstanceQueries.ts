import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instanceServiceClient } from "@/connect";
import { InstanceSetting, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";

// Query keys factory
export const instanceKeys = {
  all: ["instance"] as const,
  profile: () => [...instanceKeys.all, "profile"] as const,
  settings: () => [...instanceKeys.all, "settings"] as const,
  setting: (key: InstanceSetting_Key) => [...instanceKeys.settings(), key] as const,
};

// Build setting name from key
const buildInstanceSettingName = (key: InstanceSetting_Key): string => {
  const keyName = InstanceSetting_Key[key];
  return `instance/settings/${keyName}`;
};

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

// Hook to update instance setting
export function useUpdateInstanceSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (setting: InstanceSetting) => {
      await instanceServiceClient.updateInstanceSetting({ setting });
      return setting;
    },
    onSuccess: (setting) => {
      // Extract key from setting name and invalidate
      const keyMatch = setting.name.match(/instance\/settings\/(\w+)/);
      if (keyMatch) {
        const keyName = keyMatch[1] as keyof typeof InstanceSetting_Key;
        const key = InstanceSetting_Key[keyName];
        if (key !== undefined) {
          queryClient.setQueryData(instanceKeys.setting(key), setting);
        }
      }
      queryClient.invalidateQueries({ queryKey: instanceKeys.settings() });
    },
  });
}

// Derived hooks for common settings
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
