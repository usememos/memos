import axios from "axios";

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || "";
axios.defaults.withCredentials = true;

export function getStorageList() {
  return axios.get<ObjectStorage[]>(`/api/v1/storage`);
}

export function createStorage(storageCreate: StorageCreate) {
  return axios.post<ObjectStorage>(`/api/v1/storage`, storageCreate);
}

export function patchStorage(storagePatch: StoragePatch) {
  return axios.patch<ObjectStorage>(`/api/v1/storage/${storagePatch.id}`, storagePatch);
}

export function deleteStorage(storageId: StorageId) {
  return axios.delete(`/api/v1/storage/${storageId}`);
}

export function getIdentityProviderList() {
  return axios.get<IdentityProvider[]>(`/api/v1/idp`);
}

export function createIdentityProvider(identityProviderCreate: IdentityProviderCreate) {
  return axios.post<IdentityProvider>(`/api/v1/idp`, identityProviderCreate);
}

export function patchIdentityProvider(identityProviderPatch: IdentityProviderPatch) {
  return axios.patch<IdentityProvider>(`/api/v1/idp/${identityProviderPatch.id}`, identityProviderPatch);
}

export function deleteIdentityProvider(id: IdentityProviderId) {
  return axios.delete(`/api/v1/idp/${id}`);
}
