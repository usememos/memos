import * as api from "../helpers/api";

const resourceService = {
  /**
   * Upload resource file to server,
   * @param file file
   * @returns resource: id, filename
   */
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
};

export default resourceService;
