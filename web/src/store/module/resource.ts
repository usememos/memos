import store, { useAppSelector } from "../";
import { patchResource, setResources, deleteResource } from "../reducer/resource";
import * as api from "../../helpers/api";

const convertResponseModelResource = (resource: Resource): Resource => {
  return {
    ...resource,
    createdTs: resource.createdTs * 1000,
    updatedTs: resource.updatedTs * 1000,
  };
};

export const useResourceStore = () => {
  const state = useAppSelector((state) => state.resource);

  return {
    state,
    getState: () => {
      return store.getState().resource;
    },
    async fetchResourceList(): Promise<Resource[]> {
      const { data } = (await api.getResourceList()).data;
      const resourceList = data.map((m) => convertResponseModelResource(m));
      store.dispatch(setResources(resourceList));
      return resourceList;
    },
    async upload(file: File): Promise<Resource> {
      const { name: filename, size } = file;

      if (size > 64 << 20) {
        return Promise.reject("overload max size: 8MB");
      }

      const formData = new FormData();
      formData.append("file", file, filename);
      const { data } = (await api.uploadFile(formData)).data;
      const resource = convertResponseModelResource(data);
      const resourceList = state.resources;
      store.dispatch(setResources([resource, ...resourceList]));
      return resource;
    },
    async deleteResourceById(id: ResourceId) {
      await api.deleteResourceById(id);
      store.dispatch(deleteResource(id));
    },
    async patchResource(resourcePatch: ResourcePatch): Promise<Resource> {
      const { data } = (await api.patchResource(resourcePatch)).data;
      const resource = convertResponseModelResource(data);
      store.dispatch(patchResource(resource));
      return resource;
    },
  };
};
