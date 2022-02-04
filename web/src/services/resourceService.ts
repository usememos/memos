import api from "../helpers/api";

class ResourceService {
  /**
   * Upload resource file to server,
   * @param file file
   * @returns resource: id, filename
   */
  public async upload(file: File) {
    const { name: filename, size } = file;

    if (size > 5 << 20) {
      return Promise.reject("超过最大文件大小 5Mb");
    }

    const formData = new FormData();

    formData.append("file", file, filename);

    const data = await api.uploadFile(formData);

    return data;
  }
}

const resourceService = new ResourceService();

export default resourceService;
