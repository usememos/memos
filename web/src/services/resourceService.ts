import * as api from "../helpers/api";

const convertResponseModelResource = (resource: Resource): Resource => {
  return {
    ...resource,
    createdTs: resource.createdTs * 1000,
    updatedTs: resource.updatedTs * 1000,
  };
};

const resourceService = {
  async getResourceList(): Promise<Resource[]> {
    const { data } = (await api.getResourceList()).data;
    const resourceList = data.map((m) => convertResponseModelResource(m));
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

    return data;
  },
  async deleteResourceById(id: ResourceId) {
    return api.deleteResourceById(id);
  },
};

export default resourceService;
