import axios from "axios";

type ResponseObject<T> = {
  data: T;
  error?: string;
  message?: string;
};

export function getSystemStatus() {
  return axios.get<ResponseObject<SystemStatus>>("/api/status");
}

export function upsertSystemSetting(systemSetting: SystemSetting) {
  return axios.post<ResponseObject<SystemSetting>>("/api/system/setting", systemSetting);
}

export function vacuumDatabase() {
  return axios.post("/api/system/vacuum");
}

export function signin(username: string, password: string) {
  return axios.post<ResponseObject<User>>("/api/auth/signin", {
    username,
    password,
  });
}

export function signup(username: string, password: string, role: UserRole) {
  return axios.post<ResponseObject<User>>("/api/auth/signup", {
    username,
    password,
    role,
  });
}

export function signout() {
  return axios.post("/api/auth/signout");
}

export function createUser(userCreate: UserCreate) {
  return axios.post<ResponseObject<User>>("/api/user", userCreate);
}

export function getMyselfUser() {
  return axios.get<ResponseObject<User>>("/api/user/me");
}

export function getUserList() {
  return axios.get<ResponseObject<User[]>>("/api/user");
}

export function getUserById(id: number) {
  return axios.get<ResponseObject<User>>(`/api/user/${id}`);
}

export function upsertUserSetting(upsert: UserSettingUpsert) {
  return axios.post<ResponseObject<UserSetting>>(`/api/user/setting`, upsert);
}

export function patchUser(userPatch: UserPatch) {
  return axios.patch<ResponseObject<User>>(`/api/user/${userPatch.id}`, userPatch);
}

export function deleteUser(userDelete: UserDelete) {
  return axios.delete(`/api/user/${userDelete.id}`);
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
  return axios.get<ResponseObject<Shortcut[]>>(`/api/shortcut?${queryList.join("&")}`);
}

export function createShortcut(shortcutCreate: ShortcutCreate) {
  return axios.post<ResponseObject<Shortcut>>("/api/shortcut", shortcutCreate);
}

export function patchShortcut(shortcutPatch: ShortcutPatch) {
  return axios.patch<ResponseObject<Shortcut>>(`/api/shortcut/${shortcutPatch.id}`, shortcutPatch);
}

export function deleteShortcutById(shortcutId: ShortcutId) {
  return axios.delete(`/api/shortcut/${shortcutId}`);
}

export function getResourceList() {
  return axios.get<ResponseObject<Resource[]>>("/api/resource");
}

export function uploadFile(formData: FormData) {
  return axios.post<ResponseObject<Resource>>("/api/resource", formData);
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
  return axios.get<ResponseObject<string[]>>(`/api/tag?${queryList.join("&")}`);
}

export function getTagSuggestionList() {
  return axios.get<ResponseObject<string[]>>(`/api/tag/suggestion`);
}

export function upsertTag(tagName: string) {
  return axios.post<ResponseObject<string>>(`/api/tag`, {
    name: tagName,
  });
}

export function deleteTag(tagName: string) {
  return axios.delete<ResponseObject<string>>(`/api/tag/${tagName}`);
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
