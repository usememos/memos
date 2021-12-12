import utils from "./utils";

type ResponseType<T = unknown> = {
  succeed: boolean;
  message: string;
  data: T;
};

async function request<T>(method: string, url: string, data?: any): Promise<ResponseType<T>> {
  const requestConfig: RequestInit = {
    method,
  };

  if (method !== "GET") {
    requestConfig.headers = {
      "Content-Type": "application/json",
    };
    if (data !== null) {
    }
    requestConfig.body = JSON.stringify(data);
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
    return request<Model.User>("GET", "/api/user/me");
  }

  export function signin(username: string, password: string) {
    return request("POST", "/api/auth/signin", { username, password });
  }

  export function signup(username: string, password: string) {
    return request("POST", "/api/auth/signup", { username, password });
  }

  export function signout() {
    return request("POST", "/api/auth/signout");
  }

  export function checkUsernameUsable(username: string) {
    return request<boolean>("POST", "/api/user/checkusername", { username });
  }

  export function checkPasswordValid(password: string) {
    return request<boolean>("POST", "/api/user/validpassword", { password });
  }

  export function updateUserinfo(userinfo: Partial<{ username: string; password: string; githubName: string }>) {
    return request("PATCH", "/api/user/me", userinfo);
  }

  export function getMyMemos() {
    return request<Model.Memo[]>("GET", "/api/memo/all");
  }

  export function getMyDeletedMemos() {
    return request<Model.Memo[]>("GET", "/api/memo/all?deleted=true");
  }

  export function createMemo(content: string) {
    return request<Model.Memo>("PUT", "/api/memo/", { content });
  }

  export function updateMemo(memoId: string, content: string) {
    return request<Model.Memo>("PATCH", `/api/memo/${memoId}`, { content });
  }

  export function hideMemo(memoId: string) {
    return request("PATCH", `/api/memo/${memoId}`, {
      deletedAt: utils.getDateTimeString(Date.now()),
    });
  }

  export function restoreMemo(memoId: string) {
    return request("PATCH", `/api/memo/${memoId}`, {
      deletedAt: "",
    });
  }

  export function deleteMemo(memoId: string) {
    return request("DELETE", `/api/memo/${memoId}`);
  }

  export function getMyQueries() {
    return request<Model.Query[]>("GET", "/api/query/all");
  }

  export function createQuery(title: string, querystring: string) {
    return request<Model.Query>("PUT", "/api/query/", { title, querystring });
  }

  export function updateQuery(queryId: string, title: string, querystring: string) {
    return request<Model.Query>("PATCH", `/api/query/${queryId}`, { title, querystring });
  }

  export function deleteQueryById(queryId: string) {
    return request("DELETE", `/api/query/${queryId}`);
  }

  export function pinQuery(queryId: string) {
    return request("PATCH", `/api/query/${queryId}`, { pinnedAt: utils.getDateTimeString(Date.now()) });
  }

  export function unpinQuery(queryId: string) {
    return request("PATCH", `/api/query/${queryId}`, { pinnedAt: "" });
  }
}

export default api;
