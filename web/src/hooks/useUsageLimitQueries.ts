import { create } from "@bufbuild/protobuf";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInstanceSetting, useUpdateInstanceSetting } from "@/hooks/useInstanceQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { buildInstanceSettingName } from "@/lib/resource-names";
import {
  InstanceSetting_Key,
  type InstanceSetting_UsageLimitsSetting_UsageLimit,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";

export type UsageLimitEntry = InstanceSetting_UsageLimitsSetting_UsageLimit;

/**
 * The usage limits, in the order they are checked. The server returns the
 * built-in default when nothing is stored, so the list always ends with the
 * all-users entry. Admin only on the server side.
 */
export function useUsageLimits() {
  const query = useInstanceSetting(InstanceSetting_Key.USAGE_LIMITS);
  const limits = query.data?.value.case === "usageLimitsSetting" ? query.data.value.value.limits : undefined;
  return { ...query, limits };
}

/** Replaces the whole usage limits list. */
export function useSaveUsageLimits() {
  const queryClient = useQueryClient();
  const updateSetting = useUpdateInstanceSetting();
  return useMutation({
    mutationFn: async (limits: UsageLimitEntry[]) => {
      await updateSetting.mutateAsync(
        create(InstanceSettingSchema, {
          name: buildInstanceSettingName(InstanceSetting_Key.USAGE_LIMITS),
          value: { case: "usageLimitsSetting", value: { limits } },
        }),
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
  });
}
