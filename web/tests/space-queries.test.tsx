import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  spaceKeys,
  useAcceptSpaceInvitation,
  useCreateSpace,
  useCreateSpaceInvitation,
  useDeclineSpaceInvitation,
  useDeleteSpace,
  useDeleteSpaceInvitation,
  useDeleteSpaceMember,
  useSpaceInvitations,
  useSpaceMembers,
  useSpaces,
  useUpdateSpace,
  useUpdateSpaceMember,
  useUserSpaceInvitations,
} from "@/hooks/useSpaceQueries";
import { SpaceInvitationSchema, SpaceMember_Role, SpaceMemberSchema, SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const clients = vi.hoisted(() => ({
  acceptSpaceInvitation: vi.fn(),
  createSpace: vi.fn(),
  createSpaceInvitation: vi.fn(),
  declineSpaceInvitation: vi.fn(),
  deleteSpace: vi.fn(),
  deleteSpaceInvitation: vi.fn(),
  deleteSpaceMember: vi.fn(),
  listSpaceInvitations: vi.fn(),
  listSpaceMembers: vi.fn(),
  listSpaces: vi.fn(),
  listUserSpaceInvitations: vi.fn(),
  updateSpace: vi.fn(),
  updateSpaceMember: vi.fn(),
}));

vi.mock("@/connect", () => ({
  spaceServiceClient: clients,
}));

const VIEWER = "users/test";
const OTHER_VIEWER = "users/other";
const SPACE_NAME = "spaces/product";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

describe("Space queries", () => {
  beforeEach(() => {
    for (const client of Object.values(clients)) {
      client.mockReset();
    }
  });

  it("loads every page so the switcher can show all available Spaces", async () => {
    clients.listSpaces
      .mockResolvedValueOnce({
        spaces: [create(SpaceSchema, { name: "spaces/one", title: "One" })],
        nextPageToken: "next",
      })
      .mockResolvedValueOnce({
        spaces: [create(SpaceSchema, { name: "spaces/two", title: "Two" })],
        nextPageToken: "",
      });

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useSpaces(VIEWER), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.data?.map((space) => space.name)).toEqual(["spaces/one", "spaces/two"]));
    expect(clients.listSpaces).toHaveBeenNthCalledWith(1, { pageSize: 1000, pageToken: "" });
    expect(clients.listSpaces).toHaveBeenNthCalledWith(2, { pageSize: 1000, pageToken: "next" });
  });

  it("drains member and invitation pages with viewer-scoped cache keys", async () => {
    const admin = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/admin`,
      user: "users/admin",
      role: SpaceMember_Role.ADMIN,
    });
    const member = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/member`,
      user: "users/member",
      role: SpaceMember_Role.USER,
    });
    const firstInvitation = create(SpaceInvitationSchema, {
      name: `${SPACE_NAME}/invitations/first`,
      invitee: "users/first",
      role: SpaceMember_Role.USER,
    });
    const secondInvitation = create(SpaceInvitationSchema, {
      name: `${SPACE_NAME}/invitations/second`,
      invitee: "users/second",
      role: SpaceMember_Role.ADMIN,
    });

    clients.listSpaceMembers
      .mockResolvedValueOnce({ spaceMembers: [admin], nextPageToken: "member-next" })
      .mockResolvedValueOnce({ spaceMembers: [member], nextPageToken: "" });
    clients.listSpaceInvitations
      .mockResolvedValueOnce({ spaceInvitations: [firstInvitation], nextPageToken: "invitation-next" })
      .mockResolvedValueOnce({ spaceInvitations: [secondInvitation], nextPageToken: "" });
    clients.listUserSpaceInvitations
      .mockResolvedValueOnce({ spaceInvitations: [firstInvitation], nextPageToken: "user-next" })
      .mockResolvedValueOnce({ spaceInvitations: [secondInvitation], nextPageToken: "" });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => ({
        members: useSpaceMembers(VIEWER, SPACE_NAME),
        spaceInvitations: useSpaceInvitations(VIEWER, SPACE_NAME),
        userInvitations: useUserSpaceInvitations(VIEWER),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.members.data).toHaveLength(2);
      expect(result.current.spaceInvitations.data).toHaveLength(2);
      expect(result.current.userInvitations.data).toHaveLength(2);
    });
    expect(clients.listSpaceMembers).toHaveBeenNthCalledWith(1, {
      parent: SPACE_NAME,
      pageSize: 1000,
      pageToken: "",
    });
    expect(clients.listSpaceMembers).toHaveBeenNthCalledWith(2, {
      parent: SPACE_NAME,
      pageSize: 1000,
      pageToken: "member-next",
    });
    expect(clients.listSpaceInvitations).toHaveBeenNthCalledWith(2, {
      parent: SPACE_NAME,
      pageSize: 1000,
      pageToken: "invitation-next",
    });
    expect(clients.listUserSpaceInvitations).toHaveBeenNthCalledWith(2, {
      parent: VIEWER,
      pageSize: 1000,
      pageToken: "user-next",
    });
    expect(spaceKeys.members(VIEWER, SPACE_NAME)).not.toEqual(spaceKeys.members(OTHER_VIEWER, SPACE_NAME));
    expect(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME)).not.toEqual(spaceKeys.spaceInvitations(OTHER_VIEWER, SPACE_NAME));
    expect(spaceKeys.userInvitations(VIEWER)).not.toEqual(spaceKeys.userInvitations(OTHER_VIEWER));
  });

  it("honors disabled query options without calling the service", async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => ({
        members: useSpaceMembers(VIEWER, SPACE_NAME, { enabled: false }),
        spaceInvitations: useSpaceInvitations(VIEWER, SPACE_NAME, { enabled: false }),
        userInvitations: useUserSpaceInvitations(VIEWER, { enabled: false }),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.members.fetchStatus).toBe("idle"));
    expect(clients.listSpaceMembers).not.toHaveBeenCalled();
    expect(clients.listSpaceInvitations).not.toHaveBeenCalled();
    expect(clients.listUserSpaceInvitations).not.toHaveBeenCalled();
  });

  it("creates, updates, and deletes Spaces in the current viewer cache", async () => {
    const originalSpace = create(SpaceSchema, { name: SPACE_NAME, title: "Product", description: "Plans" });
    const updatedSpace = create(SpaceSchema, { name: SPACE_NAME, title: "Roadmap", description: "Plans" });
    const createdSpace = create(SpaceSchema, { name: "spaces/research", title: "Research", description: "Notes" });
    const cachedMember = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/test`,
      user: VIEWER,
      role: SpaceMember_Role.ADMIN,
    });
    clients.createSpace.mockResolvedValue(createdSpace);
    clients.updateSpace.mockResolvedValue(updatedSpace);
    clients.deleteSpace.mockResolvedValue({});

    const queryClient = createQueryClient();
    queryClient.setQueryData(spaceKeys.list(VIEWER), [originalSpace]);
    queryClient.setQueryData(spaceKeys.members(VIEWER, SPACE_NAME), [cachedMember]);
    const { result } = renderHook(
      () => ({
        create: useCreateSpace(VIEWER),
        update: useUpdateSpace(VIEWER),
        remove: useDeleteSpace(VIEWER),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.create.mutateAsync({ title: "Research", description: "Notes", spaceId: "research" });
    });
    expect(clients.createSpace).toHaveBeenCalledWith({
      space: expect.objectContaining({ title: "Research", description: "Notes" }),
      spaceId: "research",
    });
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([originalSpace, createdSpace]);

    await act(async () => {
      await result.current.update.mutateAsync({
        space: { name: SPACE_NAME, title: "Roadmap" },
        updateMask: ["title"],
      });
    });
    expect(clients.updateSpace).toHaveBeenCalledWith({
      space: expect.objectContaining({ name: SPACE_NAME, title: "Roadmap" }),
      updateMask: expect.objectContaining({ paths: ["title"] }),
    });
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([updatedSpace, createdSpace]);

    await act(async () => {
      await result.current.remove.mutateAsync({ name: SPACE_NAME });
    });
    expect(clients.deleteSpace).toHaveBeenCalledWith({ name: SPACE_NAME });
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([createdSpace]);
    expect(queryClient.getQueryState(spaceKeys.members(VIEWER, SPACE_NAME))).toBeUndefined();
  });

  it("synchronizes admin invitation caches after create and delete", async () => {
    const invitation = create(SpaceInvitationSchema, {
      name: `${SPACE_NAME}/invitations/member`,
      invitee: "users/member",
      role: SpaceMember_Role.USER,
    });
    clients.createSpaceInvitation.mockResolvedValue(invitation);
    clients.deleteSpaceInvitation.mockResolvedValue({});

    const queryClient = createQueryClient();
    queryClient.setQueryData(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME), []);
    queryClient.setQueryData(spaceKeys.userInvitations(VIEWER), [invitation]);
    const { result } = renderHook(
      () => ({
        create: useCreateSpaceInvitation(VIEWER),
        remove: useDeleteSpaceInvitation(VIEWER),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.create.mutateAsync({
        parent: SPACE_NAME,
        spaceInvitation: { invitee: "users/member", role: SpaceMember_Role.USER },
      });
    });
    expect(clients.createSpaceInvitation).toHaveBeenCalledWith({
      parent: SPACE_NAME,
      spaceInvitation: expect.objectContaining({ invitee: "users/member", role: SpaceMember_Role.USER }),
    });
    expect(queryClient.getQueryData(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME))).toEqual([invitation]);

    await act(async () => {
      await result.current.remove.mutateAsync({ name: invitation.name });
    });
    expect(clients.deleteSpaceInvitation).toHaveBeenCalledWith({ name: invitation.name });
    expect(queryClient.getQueryData(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME))).toEqual([]);
    expect(queryClient.getQueryData(spaceKeys.userInvitations(VIEWER))).toEqual([]);
  });

  it("refreshes Spaces and members while clearing accepted or declined invitations", async () => {
    const acceptedSpace = create(SpaceSchema, { name: SPACE_NAME, title: "Product" });
    const acceptedInvitation = create(SpaceInvitationSchema, {
      name: `${SPACE_NAME}/invitations/test`,
      invitee: VIEWER,
      role: SpaceMember_Role.USER,
      space: acceptedSpace,
    });
    const declinedInvitation = create(SpaceInvitationSchema, {
      name: "spaces/research/invitations/test",
      invitee: VIEWER,
      role: SpaceMember_Role.USER,
    });
    const acceptedMember = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/test`,
      user: VIEWER,
      role: SpaceMember_Role.USER,
    });
    clients.acceptSpaceInvitation.mockResolvedValue(acceptedMember);
    clients.declineSpaceInvitation.mockResolvedValue({});

    const queryClient = createQueryClient();
    queryClient.setQueryData(spaceKeys.list(VIEWER), []);
    queryClient.setQueryData(spaceKeys.members(VIEWER, SPACE_NAME), []);
    queryClient.setQueryData(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME), [acceptedInvitation]);
    queryClient.setQueryData(spaceKeys.userInvitations(VIEWER), [acceptedInvitation, declinedInvitation]);
    const { result } = renderHook(
      () => ({
        accept: useAcceptSpaceInvitation(VIEWER),
        decline: useDeclineSpaceInvitation(VIEWER),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.accept.mutateAsync({ name: acceptedInvitation.name });
    });
    expect(clients.acceptSpaceInvitation).toHaveBeenCalledWith({ name: acceptedInvitation.name });
    // Invitation Space summaries omit membership-only fields and must not be
    // promoted into the authoritative list while its refetch is in flight.
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([]);
    expect(queryClient.getQueryData(spaceKeys.members(VIEWER, SPACE_NAME))).toEqual([acceptedMember]);
    expect(queryClient.getQueryData(spaceKeys.spaceInvitations(VIEWER, SPACE_NAME))).toEqual([]);
    expect(queryClient.getQueryData(spaceKeys.userInvitations(VIEWER))).toEqual([declinedInvitation]);
    expect(queryClient.getQueryState(spaceKeys.list(VIEWER))?.isInvalidated).toBe(true);

    await act(async () => {
      await result.current.decline.mutateAsync({ name: declinedInvitation.name });
    });
    expect(clients.declineSpaceInvitation).toHaveBeenCalledWith({ name: declinedInvitation.name });
    expect(queryClient.getQueryData(spaceKeys.userInvitations(VIEWER))).toEqual([]);
  });

  it("updates members and evicts a Space when the current viewer leaves", async () => {
    const space = create(SpaceSchema, { name: SPACE_NAME, title: "Product" });
    const originalMember = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/member`,
      user: "users/member",
      role: SpaceMember_Role.USER,
    });
    const updatedMember = create(SpaceMemberSchema, {
      ...originalMember,
      role: SpaceMember_Role.ADMIN,
    });
    const viewerMember = create(SpaceMemberSchema, {
      name: `${SPACE_NAME}/members/test`,
      user: VIEWER,
      role: SpaceMember_Role.ADMIN,
    });
    clients.updateSpaceMember.mockResolvedValue(updatedMember);
    clients.deleteSpaceMember.mockResolvedValue({});

    const queryClient = createQueryClient();
    queryClient.setQueryData(spaceKeys.list(VIEWER), [space]);
    queryClient.setQueryData(spaceKeys.members(VIEWER, SPACE_NAME), [originalMember, viewerMember]);
    const { result } = renderHook(
      () => ({
        update: useUpdateSpaceMember(VIEWER),
        remove: useDeleteSpaceMember(VIEWER),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.update.mutateAsync({
        spaceMember: { name: originalMember.name, role: SpaceMember_Role.ADMIN },
        updateMask: ["role"],
      });
    });
    expect(clients.updateSpaceMember).toHaveBeenCalledWith({
      spaceMember: expect.objectContaining({ name: originalMember.name, role: SpaceMember_Role.ADMIN }),
      updateMask: expect.objectContaining({ paths: ["role"] }),
    });
    expect(queryClient.getQueryData(spaceKeys.members(VIEWER, SPACE_NAME))).toEqual([updatedMember, viewerMember]);

    await act(async () => {
      await result.current.remove.mutateAsync({ name: originalMember.name });
    });
    expect(queryClient.getQueryData(spaceKeys.members(VIEWER, SPACE_NAME))).toEqual([viewerMember]);
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([space]);
    expect(queryClient.getQueryState(spaceKeys.list(VIEWER))?.isInvalidated).toBe(true);

    await act(async () => {
      await result.current.remove.mutateAsync({ name: viewerMember.name });
    });
    expect(clients.deleteSpaceMember).toHaveBeenLastCalledWith({ name: viewerMember.name });
    expect(queryClient.getQueryData(spaceKeys.list(VIEWER))).toEqual([]);
    expect(queryClient.getQueryState(spaceKeys.members(VIEWER, SPACE_NAME))).toBeUndefined();
  });
});
