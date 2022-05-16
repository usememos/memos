import utils from "./utils";

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
    return request<API.SystemStatus>({
      method: "GET",
      url: "/api/status",
    });
  }

  export function getUserList() {
    return request<Model.User[]>({
      method: "GET",
      url: "/api/user",
    });
  }

  export function createUser(userCreate: API.UserCreate) {
    return request<Model.User[]>({
      method: "POST",
      url: "/api/user",
      data: userCreate,
    });
  }

  export function login(email: string, password: string) {
    return request<Model.User>({
      method: "POST",
      url: "/api/auth/login",
      data: {
        email,
        password,
      },
    });
  }

  export function signup(email: string, password: string, role: UserRole) {
    return request<Model.User>({
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

  export function getUserInfo() {
    return request<Model.User>({
      method: "GET",
      url: "/api/user/me",
    });
  }

  export function updateUserinfo(userinfo: Partial<{ name: string; password: string; resetOpenId: boolean }>) {
    return request<Model.User>({
      method: "PATCH",
      url: "/api/user/me",
      data: userinfo,
    });
  }

  export function resetOpenId() {
    return request<string>({
      method: "POST",
      url: "/api/user/open_id/new",
    });
  }

  export function getMyMemos() {
    return request<Model.Memo[]>({
      method: "GET",
      url: "/api/memo",
    });
  }

  export function getMyDeletedMemos() {
    return request<Model.Memo[]>({
      method: "GET",
      url: "/api/memo?rowStatus=HIDDEN",
    });
  }

  export function createMemo(content: string, createdAt?: string) {
    const data: any = {
      content,
    };

    if (createdAt) {
      const createdTms = utils.getTimeStampByDate(createdAt);
      data.createdTs = Math.floor(createdTms / 1000);
    }

    return request<Model.Memo>({
      method: "POST",
      url: "/api/memo",
      data: data,
    });
  }

  export function updateMemo(memoId: string, content: string) {
    return request<Model.Memo>({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        content,
      },
    });
  }

  export function pinMemo(memoId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        rowStatus: "ARCHIVED",
      },
    });
  }

  export function unpinMemo(shortcutId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${shortcutId}`,
      data: {
        rowStatus: "NORMAL",
      },
    });
  }

  export function hideMemo(memoId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        rowStatus: "HIDDEN",
      },
    });
  }

  export function restoreMemo(memoId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        rowStatus: "NORMAL",
      },
    });
  }

  export function deleteMemo(memoId: string) {
    return request({
      method: "DELETE",
      url: `/api/memo/${memoId}`,
    });
  }

  export function getMyShortcuts() {
    return request<Model.Shortcut[]>({
      method: "GET",
      url: "/api/shortcut",
    });
  }

  export function createShortcut(title: string, payload: string) {
    return request<Model.Shortcut>({
      method: "POST",
      url: "/api/shortcut",
      data: {
        title,
        payload,
      },
    });
  }

  export function updateShortcut(shortcutId: string, title: string, payload: string) {
    return request<Model.Shortcut>({
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
    return request<Model.Resource>({
      method: "POST",
      url: "/api/resource",
      data: formData,
      dataType: "file",
    });
  }
}

export default api;
