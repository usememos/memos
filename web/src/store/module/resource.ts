import * as api from "@/helpers/api";
import { Resource } from "@/types/proto-grpcweb/api/v2/resource_service";
import { useTranslate } from "@/utils/i18n";
import store, { useAppSelector } from "../";
import { deleteResource, patchResource, setResources } from "../reducer/resource";
import { useGlobalStore } from "./global";

export const useResourceStore = () => {
  const state = useAppSelector((state) => state.resource);
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const maxUploadSizeMiB = globalStore.state.systemStatus.maxUploadSizeMiB;

  return {
    state,
    getState: () => {
      return store.getState().resource;
    },
    async fetchResourceList(): Promise<Resource[]> {
      const { data: resourceList } = await api.getResourceList();
      store.dispatch(setResources(resourceList));
      return resourceList;
    },
    async createResource(resourceCreate: ResourceCreate): Promise<Resource> {
      const { data: resource } = await api.createResource(resourceCreate);
      const resourceList = state.resources;
      store.dispatch(setResources([resource, ...resourceList]));
      return resource;
    },
    async createResourceWithBlob(file: File): Promise<Resource> {
      const { name: filename, size } = file;
      if (size > maxUploadSizeMiB * 1024 * 1024) {
        return Promise.reject(t("message.maximum-upload-size-is", { size: maxUploadSizeMiB }));
      }

      const formData = new FormData();
      formData.append("file", file, filename);
      const { data: resource } = await api.createResourceWithBlob(formData);
      const resourceList = state.resources;
      store.dispatch(setResources([resource, ...resourceList]));
      return resource;
    },
    async createResourcesWithBlob(files: FileList): Promise<Array<Resource>> {
      let newResourceList: Array<Resource> = [];
      for (const file of files) {
        const { name: filename, size } = file;
        if (size > maxUploadSizeMiB * 1024 * 1024) {
          return Promise.reject(t("message.file-exceeds-upload-limit-of", { file: filename, size: maxUploadSizeMiB }));
        }

        const formData = new FormData();
        formData.append("file", file, filename);
        const { data: resource } = await api.createResourceWithBlob(formData);
        newResourceList = [resource, ...newResourceList];
      }
      const resourceList = state.resources;
      store.dispatch(setResources([...newResourceList, ...resourceList]));
      return newResourceList;
    },
    async deleteResourceById(id: ResourceId) {
      await api.deleteResourceById(id);
      store.dispatch(deleteResource(id));
    },
    async patchResource(resourcePatch: ResourcePatch): Promise<Resource> {
      const { data: resource } = await api.patchResource(resourcePatch);
      store.dispatch(patchResource(resource));
      return resource;
    },
  };
};
