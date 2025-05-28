import { makeAutoObservable } from "mobx";
import { resourceServiceClient } from "@/grpcweb";
import { CreateResourceRequest, Resource, UpdateResourceRequest } from "@/types/proto/api/v1/resource_service";

class LocalState {
  resourceMapByName: Record<string, Resource> = {};

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
  }
}

const resourceStore = (() => {
  const state = new LocalState();

  const fetchResourceByName = async (name: string) => {
    const resource = await resourceServiceClient.getResource({
      name,
    });
    const resourceMap = { ...state.resourceMapByName };
    resourceMap[resource.name] = resource;
    state.setPartial({ resourceMapByName: resourceMap });
    return resource;
  };

  const getResourceByName = (name: string) => {
    return Object.values(state.resourceMapByName).find((r) => r.name === name);
  };

  const createResource = async (create: CreateResourceRequest): Promise<Resource> => {
    const resource = await resourceServiceClient.createResource(create);
    const resourceMap = { ...state.resourceMapByName };
    resourceMap[resource.name] = resource;
    state.setPartial({ resourceMapByName: resourceMap });
    return resource;
  };

  const updateResource = async (update: UpdateResourceRequest): Promise<Resource> => {
    const resource = await resourceServiceClient.updateResource(update);
    const resourceMap = { ...state.resourceMapByName };
    resourceMap[resource.name] = resource;
    state.setPartial({ resourceMapByName: resourceMap });
    return resource;
  };

  return {
    state,
    fetchResourceByName,
    getResourceByName,
    createResource,
    updateResource,
  };
})();

export default resourceStore;
