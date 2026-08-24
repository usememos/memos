import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spaceKeys, useCreateSpace, useSpaces } from "@/hooks/useSpaceQueries";
import { SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const clients = vi.hoisted(() => ({
  createSpace: vi.fn(),
  listSpaces: vi.fn(),
}));

vi.mock("@/connect", () => ({
  spaceServiceClient: clients,
}));

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
    clients.createSpace.mockReset();
    clients.listSpaces.mockReset();
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
    const { result } = renderHook(() => useSpaces("users/test"), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.data?.map((space) => space.name)).toEqual(["spaces/one", "spaces/two"]));
    expect(clients.listSpaces).toHaveBeenNthCalledWith(1, { pageSize: 1000, pageToken: "" });
    expect(clients.listSpaces).toHaveBeenNthCalledWith(2, { pageSize: 1000, pageToken: "next" });
  });

  it("adds a created Space to the current user's cache", async () => {
    const createdSpace = create(SpaceSchema, { name: "spaces/product", title: "Product", description: "Plans" });
    clients.createSpace.mockResolvedValue(createdSpace);
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useCreateSpace("users/test"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ title: "Product", description: "Plans" });
    });

    expect(clients.createSpace).toHaveBeenCalledWith({
      space: expect.objectContaining({ title: "Product", description: "Plans" }),
    });
    expect(queryClient.getQueryData(spaceKeys.list("users/test"))).toEqual([createdSpace]);
  });
});
