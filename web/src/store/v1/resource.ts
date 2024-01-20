import { create } from "zustand";
import { combine } from "zustand/middleware";
import { resourceServiceClient } from "@/grpcweb";
import { Resource } from "@/types/proto/api/v2/resource_service";

interface State {
  resourceMapById: Record<number, Resource>;
}

const getDefaultState = (): State => ({
  resourceMapById: {},
});

export const useResourceStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    getOrFetchResourceById: async (id: number, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const resourceMap = get().resourceMapById;
      const resource = resourceMap[id];
      if (resource && !options?.skipCache) {
        return resource;
      }

      const res = await resourceServiceClient.getResource({
        id,
      });
      if (!res.resource) {
        throw new Error("Resource not found");
      }

      if (!options?.skipStore) {
        resourceMap[id] = res.resource;
        set({ resourceMapById: resourceMap });
      }
      return res.resource;
    },
    getResourceById: (id: number) => {
      return get().resourceMapById[id];
    },
  }))
);
