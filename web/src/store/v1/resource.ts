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
    getOrFetchResourceByName: async (name: string, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const resourceMap = get().resourceMapById;
      const cachedResource = Object.values(resourceMap).find((r) => r.name === name);
      if (cachedResource && !options?.skipCache) {
        return cachedResource;
      }

      const { resource } = await resourceServiceClient.getResourceByName({
        name,
      });
      if (!resource) {
        throw new Error("Resource not found");
      }

      if (!options?.skipStore) {
        resourceMap[resource.id] = resource;
        set({ resourceMapById: resourceMap });
      }
      return resource;
    },
    getResourceByName: (name: string) => {
      const resourceMap = get().resourceMapById;
      return Object.values(resourceMap).find((r) => r.name === name);
    },
  }))
);
