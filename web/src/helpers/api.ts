import axios from "axios";

type ResponseObject<T> = {
  data: T;
  error?: string;
  message?: string;
};

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

export function signin(username: string, password: string) {
  return axios.post("/api/v1/auth/signin", {
    username,
    password,
  });
}

export function signinWithSSO(identityProviderId: IdentityProviderId, code: string, redirectUri: string) {
  return axios.post("/api/v1/auth/signin/sso", {
    identityProviderId,
    code,
    redirectUri,
  });
}

export function signup(username: string, password: string) {
  return axios.post("/api/v1/auth/signup", {
    username,
    password,
  });
}

export function signout() {
  return axios.post("/api/v1/auth/signout");
}

export function createUser(userCreate: UserCreate) {
  return axios.post<User>("/api/v1/user", userCreate);
}

export function getMyselfUser() {
  return axios.get<User>("/api/v1/user/me");
}

export function getUserList() {
  return axios.get<User[]>("/api/v1/user");
}

export function getUserById(id: number) {
  return axios.get<User>(`/api/v1/user/${id}`);
}

export function upsertUserSetting(upsert: UserSettingUpsert) {
  return axios.post<UserSetting>(`/api/v1/user/setting`, upsert);
}

export function patchUser(userPatch: UserPatch) {
  return axios.patch<User>(`/api/v1/user/${userPatch.id}`, userPatch);
}

export function deleteUser(userDelete: UserDelete) {
  return axios.delete(`/api/v1/user/${userDelete.id}`);
}

export function getAllMemos(memoFind?: MemoFind) {
  const queryList = [];
  if (memoFind?.offset) {
    queryList.push(`offset=${memoFind.offset}`);
  }
  if (memoFind?.limit) {
    queryList.push(`limit=${memoFind.limit}`);
  }

  return axios.get<ResponseObject<Memo[]>>(`/api/memo/all?${queryList.join("&")}`);
}

export function getMemoList(memoFind?: MemoFind) {
  const queryList = [];
  if (memoFind?.creatorId) {
    queryList.push(`creatorId=${memoFind.creatorId}`);
  }
  if (memoFind?.rowStatus) {
    queryList.push(`rowStatus=${memoFind.rowStatus}`);
  }
  if (memoFind?.pinned) {
    queryList.push(`pinned=${memoFind.pinned}`);
  }
  if (memoFind?.offset) {
    queryList.push(`offset=${memoFind.offset}`);
  }
  if (memoFind?.limit) {
    queryList.push(`limit=${memoFind.limit}`);
  }
  return axios.get<ResponseObject<Memo[]>>(`/api/memo?${queryList.join("&")}`);
}

export function getMemoStats(userId: UserId) {
  return axios.get<ResponseObject<number[]>>(`/api/memo/stats?creatorId=${userId}`);
}

export function getMemoById(id: MemoId) {
  return axios.get<ResponseObject<Memo>>(`/api/memo/${id}`);
}

export function createMemo(memoCreate: MemoCreate) {
  return axios.post<ResponseObject<Memo>>("/api/memo", memoCreate);
}

export function patchMemo(memoPatch: MemoPatch) {
  return axios.patch<ResponseObject<Memo>>(`/api/memo/${memoPatch.id}`, memoPatch);
}

export function pinMemo(memoId: MemoId) {
  return axios.post(`/api/memo/${memoId}/organizer`, {
    pinned: true,
  });
}

export function unpinMemo(memoId: MemoId) {
  return axios.post(`/api/memo/${memoId}/organizer`, {
    pinned: false,
  });
}

export function deleteMemo(memoId: MemoId) {
  return axios.delete(`/api/memo/${memoId}`);
}

export function getShortcutList(shortcutFind?: ShortcutFind) {
  const queryList = [];
  if (shortcutFind?.creatorId) {
    queryList.push(`creatorId=${shortcutFind.creatorId}`);
  }
  return axios.get<Shortcut[]>(`/api/v1/shortcut?${queryList.join("&")}`);
}

export function createShortcut(shortcutCreate: ShortcutCreate) {
  return axios.post<Shortcut>("/api/v1/shortcut", shortcutCreate);
}

export function patchShortcut(shortcutPatch: ShortcutPatch) {
  return axios.patch<Shortcut>(`/api/v1/shortcut/${shortcutPatch.id}`, shortcutPatch);
}

export function deleteShortcutById(shortcutId: ShortcutId) {
  return axios.delete(`/api/v1/shortcut/${shortcutId}`);
}

export function getResourceList() {
  return axios.get<ResponseObject<Resource[]>>("/api/resource");
}

export function getResourceListWithLimit(resourceFind?: ResourceFind) {
  const queryList = [];
  if (resourceFind?.offset) {
    queryList.push(`offset=${resourceFind.offset}`);
  }
  if (resourceFind?.limit) {
    queryList.push(`limit=${resourceFind.limit}`);
  }
  return axios.get<ResponseObject<Resource[]>>(`/api/resource?${queryList.join("&")}`);
}

export function createResource(resourceCreate: ResourceCreate) {
  return axios.post<ResponseObject<Resource>>("/api/resource", resourceCreate);
}

export function createResourceWithBlob(formData: FormData) {
  return axios.post<ResponseObject<Resource>>("/api/resource/blob", formData);
}

export function deleteResourceById(id: ResourceId) {
  return axios.delete(`/api/resource/${id}`);
}

export function patchResource(resourcePatch: ResourcePatch) {
  return axios.patch<ResponseObject<Resource>>(`/api/resource/${resourcePatch.id}`, resourcePatch);
}

export function getMemoResourceList(memoId: MemoId) {
  return axios.get<ResponseObject<Resource[]>>(`/api/memo/${memoId}/resource`);
}

export function upsertMemoResource(memoId: MemoId, resourceId: ResourceId) {
  return axios.post<ResponseObject<Resource>>(`/api/memo/${memoId}/resource`, {
    resourceId,
  });
}

export function deleteMemoResource(memoId: MemoId, resourceId: ResourceId) {
  return axios.delete(`/api/memo/${memoId}/resource/${resourceId}`);
}

export function getTagList(tagFind?: TagFind) {
  const queryList = [];
  if (tagFind?.creatorId) {
    queryList.push(`creatorId=${tagFind.creatorId}`);
  }
  return axios.get<string[]>(`/api/v1/tag?${queryList.join("&")}`);
}

export function getTagSuggestionList() {
  return axios.get<string[]>(`/api/v1/tag/suggestion`);
}

export function upsertTag(tagName: string) {
  return axios.post<string>(`/api/v1/tag`, {
    name: tagName,
  });
}

export function deleteTag(tagName: string) {
  return axios.post(`/api/v1/tag/delete`, {
    name: tagName,
  });
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

export async function getRepoStarCount() {
  const { data } = await axios.get(`https://api.github.com/repos/usememos/memos`, {
    headers: {
      Accept: "application/vnd.github.v3.star+json",
      Authorization: "",
    },
  });
  return data.stargazers_count as number;
}

export async function getRepoLatestTag() {
  const { data } = await axios.get(`https://api.github.com/repos/usememos/memos/tags`, {
    headers: {
      Accept: "application/vnd.github.v3.star+json",
      Authorization: "",
    },
  });
  return data[0].name as string;
}
