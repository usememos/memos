import { create } from "zustand";
import { combine } from "zustand/middleware";
import { resourceServiceClient } from "@/grpcweb";
import { CreateResourceRequest, Resource, UpdateResourceRequest } from "@/types/proto/api/v2/resource_service";

interface State {
  resourceMapByName: Record<string, Resource>;
}

const getDefaultState = (): State => ({
  resourceMapByName: {},
});

export const useResourceStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    searchResources: async (filter: string) => {
      const { resources } = await resourceServiceClient.searchResources({
        filter,
      });
      const resourceMap = get().resourceMapByName;
      for (const resource of resources) {
        resourceMap[resource.name] = resource;
      }
      set({ resourceMapByName: resourceMap });
      return resources;
    },
    getResourceByName: (name: string) => {
      const resourceMap = get().resourceMapByName;
      return Object.values(resourceMap).find((r) => r.name === name);
    },
    async createResource(create: CreateResourceRequest): Promise<Resource> {
      const { resource } = await resourceServiceClient.createResource(create);
      if (!resource) {
        throw new Error("resource is null");
      }
      const resourceMap = get().resourceMapByName;
      resourceMap[resource.name] = resource;
      return resource;
    },
    async updateResource(update: UpdateResourceRequest): Promise<Resource> {
      const { resource } = await resourceServiceClient.updateResource(update);
      if (!resource) {
        throw new Error("resource is null");
      }
      const resourceMap = get().resourceMapByName;
      resourceMap[resource.name] = resource;
      return resource;
    },
  })),
);
