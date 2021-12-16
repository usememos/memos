import utils from "./utils";

type ResponseType<T = unknown> = {
  succeed: boolean;
  message: string;
  data: T;
};

type RequestConfig = {
  method: string;
  url: string;
  data?: any;
  dataType?: "json" | "file";
};

async function request<T>(config: RequestConfig): Promise<ResponseType<T>> {
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
  const responseData = (await response.json()) as ResponseType<T>;

  if (!responseData.succeed) {
    throw responseData;
  }

  return responseData;
}

namespace api {
  export function getUserInfo() {
    return request<Model.User>({
      method: "GET",
      url: "/api/user/me",
    });
  }

  export function signin(username: string, password: string) {
    return request({
      method: "POST",
      url: "/api/auth/signin",
      data: { username, password },
    });
  }

  export function signup(username: string, password: string) {
    return request({
      method: "POST",
      url: "/api/auth/signup",
      data: { username, password },
    });
  }

  export function signout() {
    return request({
      method: "POST",
      url: "/api/auth/signout",
    });
  }

  export function checkUsernameUsable(username: string) {
    return request<boolean>({
      method: "POST",
      url: "/api/user/checkusername",
      data: { username },
    });
  }

  export function checkPasswordValid(password: string) {
    return request<boolean>({
      method: "POST",
      url: "/api/user/validpassword",
      data: { password },
    });
  }

  export function updateUserinfo(userinfo: Partial<{ username: string; password: string; githubName: string }>) {
    return request({
      method: "PATCH",
      url: "/api/user/me",
      data: userinfo,
    });
  }

  export function getMyMemos() {
    return request<Model.Memo[]>({
      method: "GET",
      url: "/api/memo/all",
    });
  }

  export function getMyDeletedMemos() {
    return request<Model.Memo[]>({
      method: "GET",
      url: "/api/memo/all?deleted=true",
    });
  }

  export function createMemo(content: string) {
    return request<Model.Memo>({
      method: "PUT",
      url: "/api/memo/",
      data: { content },
    });
  }

  export function updateMemo(memoId: string, content: string) {
    return request<Model.Memo>({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: { content },
    });
  }

  export function hideMemo(memoId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        deletedAt: utils.getDateTimeString(Date.now()),
      },
    });
  }

  export function restoreMemo(memoId: string) {
    return request({
      method: "PATCH",
      url: `/api/memo/${memoId}`,
      data: {
        deletedAt: "",
      },
    });
  }

  export function deleteMemo(memoId: string) {
    return request({
      method: "DELETE",
      url: `/api/memo/${memoId}`,
    });
  }

  export function getMyQueries() {
    return request<Model.Query[]>({
      method: "GET",
      url: "/api/query/all",
    });
  }

  export function createQuery(title: string, querystring: string) {
    return request<Model.Query>({
      method: "PUT",
      url: "/api/query/",
      data: { title, querystring },
    });
  }

  export function updateQuery(queryId: string, title: string, querystring: string) {
    return request<Model.Query>({
      method: "PATCH",
      url: `/api/query/${queryId}`,
      data: { title, querystring },
    });
  }

  export function deleteQueryById(queryId: string) {
    return request({
      method: "DELETE",
      url: `/api/query/${queryId}`,
    });
  }

  export function pinQuery(queryId: string) {
    return request({
      method: "PATCH",
      url: `/api/query/${queryId}`,
      data: { pinnedAt: utils.getDateTimeString(Date.now()) },
    });
  }

  export function unpinQuery(queryId: string) {
    return request({
      method: "PATCH",
      url: `/api/query/${queryId}`,
      data: { pinnedAt: "" },
    });
  }

  export function uploadFile(formData: FormData) {
    return request<Model.Resource>({
      method: "PUT",
      url: "/api/resource/",
      data: formData,
      dataType: "file",
    });
  }
}

export default api;
