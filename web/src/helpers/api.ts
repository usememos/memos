type ResponseObject<T> = {
  data: T;
  error?: string;
  message?: string;
};

type RequestConfig = {
  method: string;
  url: string;
  data?: any;
  dataType?: "json" | "file";
};

async function request<T>(config: RequestConfig): Promise<T> {
  const { method, url, data, dataType } = config;
  const requestConfig: RequestInit = {
    method,
  };

  if (data !== undefined) {
    if (dataType === "file") {
      requestConfig.body = data;
    } else {
      requestConfig.headers = {
        "Content-Type": "application/json",
      };
      requestConfig.body = JSON.stringify(data);
    }
  }

  const response = await fetch(url, requestConfig);
  const responseData = (await response.json()) as ResponseObject<T>;

  if (responseData.error || responseData.message) {
    throw new Error(responseData.error || responseData.message);
  }

  return responseData.data;
}

namespace api {
  export function getSystemStatus() {
    return request<SystemStatus>({
      method: "GET",
      url: "/api/status",
    });
  }

  export function login(email: string, password: string) {
    return request<User>({
      method: "POST",
      url: "/api/auth/login",
      data: {
        email,
        password,
      },
    });
  }

  export function signup(email: string, password: string, role: UserRole) {
    return request<User>({
      method: "POST",
      url: "/api/auth/signup",
      data: {
        email,
        password,
        role,
        name: email,
      },
    });
  }

  export function signout() {
    return request({
      method: "POST",
      url: "/api/auth/logout",
    });
  }

  export function createUser(userCreate: UserCreate) {
    return request<User[]>({
      method: "POST",
      url: "/api/user",
      data: userCreate,
    });
  }

  export function getUser() {
    return request<User>({
      method: "GET",
      url: "/api/user/me",
    });
  }

  export function getUserList() {
    return request<User[]>({
      method: "GET",
      url: "/api/user",
    });
  }

  export function patchUser(userPatch: UserPatch) {
    return request<User>({
      method: "PATCH",
      url: "/api/user/me",
      data: userPatch,
    });
  }

  export function getMyMemos() {
    return request<Memo[]>({
      method: "GET",
      url: "/api/memo",
    });
  }

  export function getMyArchivedMemos() {
    return request<Memo[]>({
      method: "GET",
      url: "/api/memo?rowStatus=ARCHIVED",
    });
  }

  export function createMemo(memoCreate: MemoCreate) {
    return request<Memo>({
      method: "POST",
      url: "/api/memo",
      data: memoCreate,
    });
  }

  export function patchMemo(memoPatch: MemoPatch) {
    return request<Memo>({
      method: "PATCH",
      url: `/api/memo/${memoPatch.id}`,
      data: {
        memoPatch,
      },
    });
  }

  export function pinMemo(memoId: MemoId) {
    return request({
      method: "POST",
      url: `/api/memo/${memoId}/organizer`,
      data: {
        pinned: true,
      },
    });
  }

  export function unpinMemo(memoId: MemoId) {
    return request({
      method: "POST",
      url: `/api/memo/${memoId}/organizer`,
      data: {
        pinned: false,
      },
    });
  }

  export function archiveMemo(memoId: MemoId) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        rowStatus: "ARCHIVED",
      },
    });
  }

  export function restoreMemo(memoId: MemoId) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        rowStatus: "NORMAL",
      },
    });
  }

  export function deleteMemo(memoId: MemoId) {
    return request({
      method: "DELETE",
      url: `/api/memo/${memoId}`,
    });
  }

  export function getMyShortcuts() {
    return request<Shortcut[]>({
      method: "GET",
      url: "/api/shortcut",
    });
  }

  export function createShortcut(title: string, payload: string) {
    return request<Shortcut>({
      method: "POST",
      url: "/api/shortcut",
      data: {
        title,
        payload,
      },
    });
  }

  export function updateShortcut(shortcutId: string, title: string, payload: string) {
    return request<Shortcut>({
      method: "PATCH",
      url: `/api/shortcut/${shortcutId}`,
      data: {
        title,
        payload,
      },
    });
  }

  export function deleteShortcutById(shortcutId: string) {
    return request({
      method: "DELETE",
      url: `/api/shortcut/${shortcutId}`,
    });
  }

  export function pinShortcut(shortcutId: string) {
    return request({
      method: "PATCH",
      url: `/api/shortcut/${shortcutId}`,
      data: {
        rowStatus: "ARCHIVED",
      },
    });
  }

  export function unpinShortcut(shortcutId: string) {
    return request({
      method: "PATCH",
      url: `/api/shortcut/${shortcutId}`,
      data: {
        rowStatus: "NORMAL",
      },
    });
  }

  export function uploadFile(formData: FormData) {
    return request<Resource>({
      method: "POST",
      url: "/api/resource",
      data: formData,
      dataType: "file",
    });
  }
}

export default api;
