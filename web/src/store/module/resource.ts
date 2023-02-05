import store, { useAppSelector } from "../";
import { patchResource, setResources, deleteResource } from "../reducer/resource";
import * as api from "../../helpers/api";
import { last } from "lodash-es";

const MAX_FILE_SIZE = 32 << 20;

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
    async createResource(resourceCreate: ResourceCreate): Promise<Resource> {
      const { data } = (await api.createResource(resourceCreate)).data;
      const resource = convertResponseModelResource(data);
      const resourceList = state.resources;
      store.dispatch(setResources([resource, ...resourceList]));
      return resource;
    },
    async createResourceWithBlob(file: File, storageConfig?: StorageConfig): Promise<Resource> {
      const { name: filename, size, type } = file;
      if (size > MAX_FILE_SIZE) {
        return Promise.reject("overload max size: 32MB");
      }
      const formData = new FormData();
      let resource;
      if (type.startsWith("image") && storageConfig?.imageStorage === "SMMS") {
        formData.append("smfile", file, filename);
        const { data } = (await api.uploadImageWithSMMS(formData, storageConfig.smmsConfig)).data;
        const resourceCreate = {
          filename: data.filename,
          externalLink: data.url,
          type: `image/${last(data.filename.split("."))}`,
        };
        const { data: createdData } = (await api.createResource(resourceCreate)).data;
        resource = convertResponseModelResource(createdData);
      } else {
        formData.append("file", file, filename);
        const { data } = (await api.createResourceWithBlob(formData)).data;
        resource = convertResponseModelResource(data);
      }
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
