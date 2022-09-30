import axios from "axios";

type ResponseObject<T> = {
  data: T;
  error?: string;
  message?: string;
};

export function getSystemStatus() {
  return axios.get<ResponseObject<SystemStatus>>("/api/status");
}

export function signin(email: string, password: string) {
  return axios.post<ResponseObject<User>>("/api/auth/signin", {
    email,
    password,
  });
}

export function signup(email: string, password: string, role: UserRole) {
  return axios.post<ResponseObject<User>>("/api/auth/signup", {
    email,
    password,
    role,
    name: email,
  });
}

export function signout() {
  return axios.post("/api/auth/logout");
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

export function getAllMemos() {
  return axios.get<ResponseObject<Memo[]>>("/api/memo/all");
}

export function getMemoList(memoFind?: MemoFind) {
  const queryList = [];
  if (memoFind?.creatorId) {
    queryList.push(`creatorId=${memoFind.creatorId}`);
  }
  if (memoFind?.rowStatus) {
    queryList.push(`rowStatus=${memoFind.rowStatus}`);
  }
  return axios.get<ResponseObject<Memo[]>>(`/api/memo?${queryList.join("&")}`);
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

export async function getRepoStarCount() {
  const { data } = await axios.get(`https://api.github.com/repos/usememos/memos`, {
    headers: {
      Accept: "application/vnd.github.v3.star+json",
      Authorization: "",
    },
  });
  return data.stargazers_count as number;
}
