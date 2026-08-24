import { create } from "@bufbuild/protobuf";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { spaceServiceClient } from "@/connect";
import { type Space, SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const SPACE_LIST_PAGE_SIZE = 1000;

export const spaceKeys = {
  all: ["spaces"] as const,
  lists: () => [...spaceKeys.all, "list"] as const,
  list: (userName: string) => [...spaceKeys.lists(), userName] as const,
};

export function useSpaces(userName: string | undefined) {
  return useQuery({
    queryKey: spaceKeys.list(userName ?? ""),
    queryFn: async () => {
      const spaces: Space[] = [];
      let pageToken = "";

      do {
        const response = await spaceServiceClient.listSpaces({
          pageSize: SPACE_LIST_PAGE_SIZE,
          pageToken,
        });
        spaces.push(...response.spaces);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return spaces;
    },
    enabled: Boolean(userName),
    // SpaceProvider wraps the whole route tree, so this drains every page on boot.
    // Space membership is near-static, so don't re-run that loop on each tab return.
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSpace(userName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      spaceServiceClient.createSpace({
        space: create(SpaceSchema, { title, description }),
      }),
    onSuccess: (space) => {
      queryClient.setQueryData<Space[]>(spaceKeys.list(userName), (spaces = []) => [...spaces, space]);
    },
  });
}
