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

export function patchUser(userPatch: UserPatch) {
  return axios.patch<ResponseObject<User>>("/api/user/me", userPatch);
}

export function getMyMemos() {
  return axios.get<ResponseObject<Memo[]>>("/api/memo");
}

export function getMyArchivedMemos() {
  return axios.get<ResponseObject<Memo[]>>("/api/memo?rowStatus=ARCHIVED");
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

export function getMyShortcuts() {
  return axios.get<ResponseObject<Shortcut[]>>("/api/shortcut");
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
