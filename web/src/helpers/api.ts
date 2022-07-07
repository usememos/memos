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

export function login(email: string, password: string) {
  return axios.post<ResponseObject<User>>("/api/auth/login", {
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

export function getMemoList(userId?: number) {
  return axios.get<ResponseObject<Memo[]>>(`/api/memo${userId ? "?userID=" + userId : ""}`);
}

export function getArchivedMemoList(userId?: number) {
  return axios.get<ResponseObject<Memo[]>>(`/api/memo?rowStatus=ARCHIVED${userId ? "&userID=" + userId : ""}`);
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

export function getShortcutList(userId?: number) {
  return axios.get<ResponseObject<Shortcut[]>>(`/api/shortcut${userId ? "?userID=" + userId : ""}`);
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

export function getTagList(userId?: number) {
  return axios.get<ResponseObject<string[]>>(`/api/tag${userId ? "?userID=" + userId : ""}`);
}
