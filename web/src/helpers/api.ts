import axios from "axios";
import { Resource } from "@/types/proto/api/v2/resource_service";

export function getSystemStatus() {
  return axios.get<SystemStatus>("/api/v1/status");
}

export function getSystemSetting() {
  return axios.get<SystemSetting[]>("/api/v1/system/setting");
}

export function upsertSystemSetting(systemSetting: SystemSetting) {
  return axios.post<SystemSetting>("/api/v1/system/setting", systemSetting);
}

export function vacuumDatabase() {
  return axios.post("/api/v1/system/vacuum");
}

export function signin(username: string, password: string, remember: boolean) {
  return axios.post<User>("/api/v1/auth/signin", {
    username,
    password,
    remember,
  });
}

export function signinWithSSO(identityProviderId: IdentityProviderId, code: string, redirectUri: string) {
  return axios.post<User>("/api/v1/auth/signin/sso", {
    identityProviderId,
    code,
    redirectUri,
  });
}

export function signup(username: string, password: string) {
  return axios.post<User>("/api/v1/auth/signup", {
    username,
    password,
  });
}

export function signout() {
  return axios.post("/api/v1/auth/signout");
}

export function createResourceWithBlob(formData: FormData) {
  return axios.post<Resource>("/api/v1/resource/blob", formData);
}

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
