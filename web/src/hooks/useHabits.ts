import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { habitServiceClient } from "@/connect";
import { HabitSchema } from "@/types/proto/api/v1/habit_service_pb";

export interface HabitDraft {
  title: string;
  identity: string;
  cue: string;
  environment: string;
  minimumValue: number;
  targetValue: number;
  startDate: string;
}

export const habitKeys = {
  all: ["habits"] as const,
  list: () => [...habitKeys.all, "list"] as const,
  summary: (name: string, asOfDate: string) => [...habitKeys.all, "summary", name, asOfDate] as const,
};

export const useHabits = () =>
  useQuery({
    queryKey: habitKeys.list(),
    queryFn: async () => (await habitServiceClient.listHabits({})).habits,
  });

export const useHabitSummary = (name: string | undefined, asOfDate: string, enabled = true) =>
  useQuery({
    queryKey: habitKeys.summary(name ?? "", asOfDate),
    queryFn: () => habitServiceClient.getHabitSummary({ name, asOfDate, days: 14 }),
    enabled: Boolean(name) && enabled,
  });

export const useCreateHabit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: HabitDraft) => habitServiceClient.createHabit({ habit: create(HabitSchema, draft) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  });
};

export const useUpdateHabit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, draft }: { name: string; draft: HabitDraft }) =>
      habitServiceClient.updateHabit({
        habit: create(HabitSchema, { name, ...draft }),
        updateMask: create(FieldMaskSchema, {
          paths: ["title", "identity", "cue", "environment", "minimum_value", "target_value", "start_date"],
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  });
};

export const useUpsertHabitLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ parent, logDate, value }: { parent: string; logDate: string; value: number }) =>
      habitServiceClient.upsertHabitLog({ parent, log: { logDate, value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  });
};

export const useDeleteHabitLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ parent, logDate }: { parent: string; logDate: string }) => habitServiceClient.deleteHabitLog({ parent, logDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  });
};

export const useDeleteHabit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => habitServiceClient.deleteHabit({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  });
};
