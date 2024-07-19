import { create } from "zustand";
import { combine } from "zustand/middleware";
import { resourceServiceClient } from "@/grpcweb";
import { CreateResourceRequest, Resource, UpdateResourceRequest } from "@/types/proto/api/v1/resource_service";

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
    fetchResourceByUID: async (uid: string) => {
      const resource = await resourceServiceClient.getResourceByUid({
        uid,
      });
      const resourceMap = get().resourceMapByName;
      resourceMap[resource.name] = resource;
      set({ resourceMapByName: resourceMap });
      return resource;
    },
    getResourceByName: (name: string) => {
      const resourceMap = get().resourceMapByName;
      return Object.values(resourceMap).find((r) => r.name === name);
    },
    async createResource(create: CreateResourceRequest): Promise<Resource> {
      const resource = await resourceServiceClient.createResource(create);
      const resourceMap = get().resourceMapByName;
      resourceMap[resource.name] = resource;
      return resource;
    },
    async updateResource(update: UpdateResourceRequest): Promise<Resource> {
      const resource = await resourceServiceClient.updateResource(update);
      const resourceMap = get().resourceMapByName;
      resourceMap[resource.name] = resource;
      return resource;
    },
  })),
);
