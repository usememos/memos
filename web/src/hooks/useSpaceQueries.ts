import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { spaceServiceClient } from "@/connect";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import {
  type Space,
  type SpaceInvitation,
  SpaceInvitationSchema,
  type SpaceMember,
  SpaceMemberSchema,
  SpaceSchema,
} from "@/types/proto/api/v1/space_service_pb";

const SPACE_LIST_PAGE_SIZE = 1000;
const SPACE_LIST_STALE_TIME = 1000 * 60 * 5;

export interface SpaceQueryOptions {
  enabled?: boolean;
}

export type UpdateSpaceVariables = {
  space: Partial<Space> & Pick<Space, "name">;
  updateMask: string[];
};

export type DeleteSpaceVariables = {
  name: string;
};

export type CreateSpaceInvitationVariables = {
  parent: string;
  spaceInvitation: Pick<SpaceInvitation, "invitee" | "role">;
};

export type SpaceInvitationNameVariables = {
  name: string;
};

export type UpdateSpaceMemberVariables = {
  spaceMember: Partial<SpaceMember> & Pick<SpaceMember, "name">;
  updateMask: string[];
};

export type DeleteSpaceMemberVariables = {
  name: string;
};

export const spaceKeys = {
  all: ["spaces"] as const,
  lists: () => [...spaceKeys.all, "list"] as const,
  list: (viewerName: string) => [...spaceKeys.lists(), viewerName] as const,
  space: (viewerName: string, spaceName: string) => [...spaceKeys.all, "space", viewerName, spaceName] as const,
  members: (viewerName: string, spaceName: string) => [...spaceKeys.space(viewerName, spaceName), "members"] as const,
  spaceInvitations: (viewerName: string, spaceName: string) => [...spaceKeys.space(viewerName, spaceName), "invitations"] as const,
  userInvitations: (viewerName: string) => [...spaceKeys.all, "user-invitations", viewerName] as const,
};

const queryEnabled = (viewerName: string | undefined, resourceName: string | undefined, options?: SpaceQueryOptions) =>
  Boolean(viewerName && resourceName) && (options?.enabled ?? true);

const spaceNameFromChildResource = (name: string): string | undefined => {
  const [collection, spaceID] = name.split("/");
  return collection === "spaces" && spaceID ? `${collection}/${spaceID}` : undefined;
};

const resourceID = (name: string): string | undefined => name.split("/").filter(Boolean).pop();

const upsertByName = <T extends { name: string }>(items: T[], item: T): T[] => {
  const index = items.findIndex(({ name }) => name === item.name);
  if (index === -1) {
    return [...items, item];
  }

  const next = [...items];
  next[index] = item;
  return next;
};

const removeByName = <T extends { name: string }>(items: T[], name: string): T[] => items.filter((item) => item.name !== name);

const updateCachedList = <T>(queryClient: QueryClient, queryKey: QueryKey, update: (items: T[]) => T[]) => {
  const items = queryClient.getQueryData<T[]>(queryKey);
  if (items !== undefined) {
    queryClient.setQueryData<T[]>(queryKey, update(items));
  }
};

const removeSpaceFromViewerCache = (queryClient: QueryClient, viewerName: string, spaceName: string) => {
  updateCachedList<Space>(queryClient, spaceKeys.list(viewerName), (spaces) => removeByName(spaces, spaceName));
  queryClient.removeQueries({ queryKey: spaceKeys.space(viewerName, spaceName) });
};

const invalidateMembershipSensitiveQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: memoKeys.all });
  void queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: userKeys.stats() });
};

export function useSpaces(viewerName: string | undefined, options?: SpaceQueryOptions) {
  return useQuery({
    queryKey: spaceKeys.list(viewerName ?? ""),
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
    enabled: Boolean(viewerName) && (options?.enabled ?? true),
    // SpaceProvider wraps the whole route tree, so this drains every page on boot.
    // Space membership is near-static, so don't re-run that loop on each tab return.
    staleTime: SPACE_LIST_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useSpaceMembers(viewerName: string | undefined, spaceName: string | undefined, options?: SpaceQueryOptions) {
  return useQuery({
    queryKey: spaceKeys.members(viewerName ?? "", spaceName ?? ""),
    queryFn: async () => {
      const members: SpaceMember[] = [];
      let pageToken = "";

      do {
        const response = await spaceServiceClient.listSpaceMembers({
          parent: spaceName!,
          pageSize: SPACE_LIST_PAGE_SIZE,
          pageToken,
        });
        members.push(...response.spaceMembers);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return members;
    },
    enabled: queryEnabled(viewerName, spaceName, options),
  });
}

export function useSpaceInvitations(viewerName: string | undefined, spaceName: string | undefined, options?: SpaceQueryOptions) {
  return useQuery({
    queryKey: spaceKeys.spaceInvitations(viewerName ?? "", spaceName ?? ""),
    queryFn: async () => {
      const invitations: SpaceInvitation[] = [];
      let pageToken = "";

      do {
        const response = await spaceServiceClient.listSpaceInvitations({
          parent: spaceName!,
          pageSize: SPACE_LIST_PAGE_SIZE,
          pageToken,
        });
        invitations.push(...response.spaceInvitations);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return invitations;
    },
    enabled: queryEnabled(viewerName, spaceName, options),
  });
}

export function useUserSpaceInvitations(viewerName: string | undefined, options?: SpaceQueryOptions) {
  return useQuery({
    queryKey: spaceKeys.userInvitations(viewerName ?? ""),
    queryFn: async () => {
      const invitations: SpaceInvitation[] = [];
      let pageToken = "";

      do {
        const response = await spaceServiceClient.listUserSpaceInvitations({
          parent: viewerName!,
          pageSize: SPACE_LIST_PAGE_SIZE,
          pageToken,
        });
        invitations.push(...response.spaceInvitations);
        pageToken = response.nextPageToken;
      } while (pageToken);

      return invitations;
    },
    enabled: Boolean(viewerName) && (options?.enabled ?? true),
  });
}

export function useCreateSpace(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      spaceServiceClient.createSpace({
        space: create(SpaceSchema, { title, description }),
      }),
    onSuccess: (space) => {
      queryClient.setQueryData<Space[]>(spaceKeys.list(viewerName), (spaces = []) => upsertByName(spaces, space));
    },
  });
}

export function useUpdateSpace(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ space, updateMask }: UpdateSpaceVariables) =>
      spaceServiceClient.updateSpace({
        space: create(SpaceSchema, space as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      }),
    onSuccess: (space) => {
      updateCachedList<Space>(queryClient, spaceKeys.list(viewerName), (spaces) => upsertByName(spaces, space));
    },
  });
}

export function useDeleteSpace(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: DeleteSpaceVariables) => {
      await spaceServiceClient.deleteSpace({ name });
      return name;
    },
    onSuccess: (spaceName) => {
      removeSpaceFromViewerCache(queryClient, viewerName, spaceName);
      invalidateMembershipSensitiveQueries(queryClient);
    },
  });
}

export function useCreateSpaceInvitation(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parent, spaceInvitation }: CreateSpaceInvitationVariables) =>
      spaceServiceClient.createSpaceInvitation({
        parent,
        spaceInvitation: create(SpaceInvitationSchema, spaceInvitation),
      }),
    onSuccess: (invitation, { parent }) => {
      updateCachedList<SpaceInvitation>(queryClient, spaceKeys.spaceInvitations(viewerName, parent), (invitations) =>
        upsertByName(invitations, invitation),
      );
    },
  });
}

export function useDeleteSpaceInvitation(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: SpaceInvitationNameVariables) => {
      await spaceServiceClient.deleteSpaceInvitation({ name });
      return name;
    },
    onSuccess: (name) => {
      const spaceName = spaceNameFromChildResource(name);
      if (spaceName) {
        updateCachedList<SpaceInvitation>(queryClient, spaceKeys.spaceInvitations(viewerName, spaceName), (invitations) =>
          removeByName(invitations, name),
        );
      }
      updateCachedList<SpaceInvitation>(queryClient, spaceKeys.userInvitations(viewerName), (invitations) =>
        removeByName(invitations, name),
      );
    },
  });
}

export function useAcceptSpaceInvitation(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name }: SpaceInvitationNameVariables) => spaceServiceClient.acceptSpaceInvitation({ name }),
    onSuccess: (member, { name }) => {
      const userInvitationKey = spaceKeys.userInvitations(viewerName);
      const spaceName = spaceNameFromChildResource(member.name) ?? spaceNameFromChildResource(name);

      updateCachedList<SpaceInvitation>(queryClient, userInvitationKey, (invitations) => removeByName(invitations, name));
      if (spaceName) {
        updateCachedList<SpaceInvitation>(queryClient, spaceKeys.spaceInvitations(viewerName, spaceName), (invitations) =>
          removeByName(invitations, name),
        );
        updateCachedList<SpaceMember>(queryClient, spaceKeys.members(viewerName, spaceName), (members) => upsertByName(members, member));
      }

      // Invitation summaries deliberately omit membership-only Space fields. Never
      // promote that summary into the member list; refresh the authoritative list.
      void queryClient.invalidateQueries({ queryKey: spaceKeys.list(viewerName), exact: true });
      invalidateMembershipSensitiveQueries(queryClient);
    },
  });
}

export function useDeclineSpaceInvitation(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: SpaceInvitationNameVariables) => {
      await spaceServiceClient.declineSpaceInvitation({ name });
      return name;
    },
    onSuccess: (name) => {
      updateCachedList<SpaceInvitation>(queryClient, spaceKeys.userInvitations(viewerName), (invitations) =>
        removeByName(invitations, name),
      );
      const spaceName = spaceNameFromChildResource(name);
      if (spaceName) {
        updateCachedList<SpaceInvitation>(queryClient, spaceKeys.spaceInvitations(viewerName, spaceName), (invitations) =>
          removeByName(invitations, name),
        );
      }
    },
  });
}

export function useUpdateSpaceMember(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceMember, updateMask }: UpdateSpaceMemberVariables) =>
      spaceServiceClient.updateSpaceMember({
        spaceMember: create(SpaceMemberSchema, spaceMember as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      }),
    onSuccess: (member) => {
      const spaceName = spaceNameFromChildResource(member.name);
      if (spaceName) {
        updateCachedList<SpaceMember>(queryClient, spaceKeys.members(viewerName, spaceName), (members) => upsertByName(members, member));
      }
      if (member.user === viewerName) {
        void queryClient.invalidateQueries({ queryKey: spaceKeys.list(viewerName), exact: true });
      }
    },
  });
}

export function useDeleteSpaceMember(viewerName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: DeleteSpaceMemberVariables) => {
      await spaceServiceClient.deleteSpaceMember({ name });
      return name;
    },
    onSuccess: (name) => {
      const spaceName = spaceNameFromChildResource(name);
      if (!spaceName) {
        return;
      }

      const memberKey = spaceKeys.members(viewerName, spaceName);
      const deletedMember = queryClient.getQueryData<SpaceMember[]>(memberKey)?.find((member) => member.name === name);
      const viewerIsDeletedMember =
        deletedMember?.user === viewerName || (resourceID(name) !== undefined && resourceID(name) === resourceID(viewerName));

      updateCachedList<SpaceMember>(queryClient, memberKey, (members) => removeByName(members, name));
      if (viewerIsDeletedMember) {
        removeSpaceFromViewerCache(queryClient, viewerName, spaceName);
        invalidateMembershipSensitiveQueries(queryClient);
      }
      // Membership counts (and, for self-removal, membership-derived fields) are
      // authoritative list output. Refresh them without relying on those fields here.
      void queryClient.invalidateQueries({ queryKey: spaceKeys.list(viewerName), exact: true });
    },
  });
}
