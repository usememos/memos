import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instanceServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";
import { type UsageLimit, UsageLimit_Metric, UsageLimitSchema } from "@/types/proto/api/instance_service_pb";

export const usageLimitKeys = {
  all: ["usageLimits"] as const,
  list: () => [...usageLimitKeys.all, "list"] as const,
};

/** The metrics an admin can limit, in display order. */
export const USAGE_LIMIT_METRICS = [UsageLimit_Metric.MEMOS, UsageLimit_Metric.STORAGE_BYTES, UsageLimit_Metric.UPLOAD_BYTES] as const;

/** Lists every usage limit. Admin only on the server side. */
export function useUsageLimits(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: usageLimitKeys.list(),
    queryFn: async () => {
      const limits: UsageLimit[] = [];
      let pageToken = "";
      do {
        const response = await instanceServiceClient.listUsageLimits({ pageSize: 1000, pageToken });
        limits.push(...response.usageLimits);
        pageToken = response.nextPageToken;
      } while (pageToken);
      return limits;
    },
    enabled: options?.enabled ?? true,
  });
}

/** Finds the limit for metric that applies to user, or the default when user is empty. */
export function findUsageLimit(limits: UsageLimit[] | undefined, metric: UsageLimit_Metric, user = ""): UsageLimit | undefined {
  return limits?.find((limit) => limit.metric === metric && limit.user === user);
}

export interface SetUsageLimitRequest {
  metric: UsageLimit_Metric;
  /** The user, as users/{user}. Empty sets the default for every user. */
  user?: string;
  /** The new value, 0 for unlimited, or undefined to remove the limit. */
  value: bigint | undefined;
  /** The limit that exists now for this metric and user, if any. */
  existing?: UsageLimit;
}

/**
 * Creates, updates, or deletes the one usage limit for a metric and user, so
 * that forms can treat each metric as a single value.
 */
export function useSetUsageLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ metric, user = "", value, existing }: SetUsageLimitRequest) => {
      if (value === undefined) {
        if (existing) {
          await instanceServiceClient.deleteUsageLimit({ name: existing.name });
        }
        return;
      }
      if (existing) {
        if (existing.value === value) return;
        await instanceServiceClient.updateUsageLimit({
          usageLimit: create(UsageLimitSchema, { name: existing.name, value }),
          updateMask: create(FieldMaskSchema, { paths: ["value"] }),
        });
        return;
      }
      await instanceServiceClient.createUsageLimit({ usageLimit: create(UsageLimitSchema, { metric, user, value }) });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usageLimitKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ]);
    },
  });
}
