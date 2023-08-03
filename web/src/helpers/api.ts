import axios from "axios";

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

export function getUserByUsername(username: string) {
  return axios.get<User>(`/api/v1/user/name/${username}`);
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

  if (memoFind?.creatorUsername) {
    queryList.push(`creatorUsername=${memoFind.creatorUsername}`);
  }

  return axios.get<Memo[]>(`/api/v1/memo/all?${queryList.join("&")}`);
}

export function getMemoList(memoFind?: MemoFind) {
  const queryList = [];
  if (memoFind?.creatorUsername) {
    queryList.push(`creatorUsername=${memoFind.creatorUsername}`);
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
  return axios.get<Memo[]>(`/api/v1/memo?${queryList.join("&")}`);
}

export function getMemoStats(username: string) {
  return axios.get<number[]>(`/api/v1/memo/stats?creatorUsername=${username}`);
}

export function getMemoById(id: MemoId) {
  return axios.get<Memo>(`/api/v1/memo/${id}`);
}

export function createMemo(memoCreate: MemoCreate) {
  return axios.post<Memo>("/api/v1/memo", memoCreate);
}

export function patchMemo(memoPatch: MemoPatch) {
  return axios.patch<Memo>(`/api/v1/memo/${memoPatch.id}`, memoPatch);
}

export function pinMemo(memoId: MemoId) {
  return axios.post(`/api/v1/memo/${memoId}/organizer`, {
    pinned: true,
  });
}

export function unpinMemo(memoId: MemoId) {
  return axios.post(`/api/v1/memo/${memoId}/organizer`, {
    pinned: false,
  });
}

export function deleteMemo(memoId: MemoId) {
  return axios.delete(`/api/v1/memo/${memoId}`);
}

export function checkOpenAIEnabled() {
  return axios.get<boolean>(`/api/openai/enabled`);
}

export function getResourceList() {
  return axios.get<Resource[]>("/api/v1/resource");
}

export function getResourceListWithLimit(resourceFind?: ResourceFind) {
  const queryList = [];
  if (resourceFind?.offset) {
    queryList.push(`offset=${resourceFind.offset}`);
  }
  if (resourceFind?.limit) {
    queryList.push(`limit=${resourceFind.limit}`);
  }
  return axios.get<Resource[]>(`/api/v1/resource?${queryList.join("&")}`);
}

export function createResource(resourceCreate: ResourceCreate) {
  return axios.post<Resource>("/api/v1/resource", resourceCreate);
}

export function createResourceWithBlob(formData: FormData) {
  return axios.post<Resource>("/api/v1/resource/blob", formData);
}

export function patchResource(resourcePatch: ResourcePatch) {
  return axios.patch<Resource>(`/api/v1/resource/${resourcePatch.id}`, resourcePatch);
}

export function deleteResourceById(id: ResourceId) {
  return axios.delete(`/api/v1/resource/${id}`);
}

export function getMemoResourceList(memoId: MemoId) {
  return axios.get<Resource[]>(`/api/v1/memo/${memoId}/resource`);
}

export function upsertMemoResource(memoId: MemoId, resourceId: ResourceId) {
  return axios.post(`/api/v1/memo/${memoId}/resource`, {
    resourceId,
  });
}

export function deleteMemoResource(memoId: MemoId, resourceId: ResourceId) {
  return axios.delete(`/api/v1/memo/${memoId}/resource/${resourceId}`);
}

export function getTagList(tagFind?: TagFind) {
  const queryList = [];
  if (tagFind?.creatorUsername) {
    queryList.push(`creatorUsername=${tagFind.creatorUsername}`);
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
