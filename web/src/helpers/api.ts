import axios from "axios";

axios.defaults.withCredentials = true;

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

export function getUser() {
  return axios.get<ResponseObject<User>>("/api/user/me");
}

export function getUserList() {
  return axios.get<ResponseObject<User[]>>("/api/user");
}

export function getUserNameById(id: number) {
  return axios.get<ResponseObject<string>>(`/api/user/${id}/name`);
}

export function patchUser(userPatch: UserPatch) {
  return axios.patch<ResponseObject<User>>("/api/user/me", userPatch);
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

export function getShortcutList(shortcutFind: ShortcutFind) {
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

export function uploadFile(formData: FormData) {
  return axios.post<ResponseObject<Resource>>("/api/resource", formData);
}

export function getTagList(tagFind?: TagFind) {
  const queryList = [];
  if (tagFind?.creatorId) {
    queryList.push(`creatorId=${tagFind.creatorId}`);
  }
  return axios.get<ResponseObject<string[]>>(`/api/tag?${queryList.join("&")}`);
}
