import { resourceServiceClient } from "@/grpcweb";
import * as api from "@/helpers/api";
import { CreateResourceRequest, Resource, UpdateResourceRequest } from "@/types/proto/api/v2/resource_service";
import { useTranslate } from "@/utils/i18n";
import store, { useAppSelector } from "../";
import { patchResource, setResources } from "../reducer/resource";
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
    async createResource(create: CreateResourceRequest): Promise<Resource> {
      const { resource } = await resourceServiceClient.createResource(create);
      if (!resource) {
        throw new Error("resource is null");
      }
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
    async updateResource(update: UpdateResourceRequest): Promise<Resource> {
      const { resource } = await resourceServiceClient.updateResource(update);
      if (!resource) {
        throw new Error("resource is null");
      }
      store.dispatch(patchResource(resource));
      return resource;
    },
  };
};
