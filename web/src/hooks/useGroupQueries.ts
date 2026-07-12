import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupServiceClient } from "@/connect";
import { Group, GroupSchema } from "@/types/proto/api/v1/group_service_pb";

export type { Group };
export { GroupSchema };

export const groupKeys = {
  all: ["groups"] as const,
  list: () => [...groupKeys.all, "list"] as const,
  detail: (name: string) => [...groupKeys.all, "detail", name] as const,
};

export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: async () => {
      const { groups } = await groupServiceClient.listGroups({});
      return groups;
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (group: { displayName: string; description: string }) => {
      const createdGroup = await groupServiceClient.createGroup({
        group: create(GroupSchema, {
          displayName: group.displayName,
          description: group.description,
        }),
      });
      return createdGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ group, updateMask }: { group: Group; updateMask: string[] }) => {
      const updatedGroup = await groupServiceClient.updateGroup({
        group,
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedGroup;
    },
    onSuccess: (updatedGroup) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(updatedGroup.name) });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await groupServiceClient.deleteGroup({ name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() });
    },
  });
}
