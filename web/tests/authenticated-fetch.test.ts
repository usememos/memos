import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  token: "current-token" as string | null,
  expired: false,
  refresh: vi.fn(),
  redirect: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/auth-state", () => ({
  getAccessToken: () => mocks.token,
  hasStoredToken: () => true,
  isTokenExpired: () => mocks.expired,
  REQUEST_TOKEN_EXPIRY_BUFFER_MS: 30_000,
  setAccessToken: (token: string) => {
    mocks.token = token;
    mocks.expired = false;
  },
}));
vi.mock("@connectrpc/connect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@connectrpc/connect")>()),
  createClient: () => ({ refreshToken: mocks.refresh }),
}));
vi.mock("@/utils/auth-redirect", () => ({ redirectOnAuthFailure: mocks.redirect }));

import { authenticatedFetch } from "@/connect";

describe("authenticatedFetch", () => {
  beforeEach(() => {
    mocks.token = "current-token";
    mocks.expired = false;
    mocks.refresh.mockResolvedValue({ accessToken: "refreshed-token" });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("retries once after 401 with the same multipart body and refreshed token", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ status: 200 });
    const body = new FormData();
    body.append("file", new File(["content"], "a.txt"));
    const response = await authenticatedFetch("/api/v1/attachments:upload", { method: "POST", body });

    expect(response.status).toBe(200);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer current-token");
    expect(mocks.fetch.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer refreshed-token");
    for (const [, init] of mocks.fetch.mock.calls) {
      expect(init.body).toBe(body);
      expect(init.credentials).toBe("include");
      expect(init.headers.has("Content-Type")).toBe(false);
    }
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("refreshes an expired token before sending file content", async () => {
    mocks.expired = true;
    mocks.fetch.mockResolvedValue({ status: 200 });
    await authenticatedFetch("/upload");
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer refreshed-token");
  });

  it("does not retry a size rejection", async () => {
    mocks.fetch.mockResolvedValue({ status: 413 });
    expect((await authenticatedFetch("/upload")).status).toBe(413);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("redirects when the refreshed token is also rejected", async () => {
    mocks.fetch.mockResolvedValue({ status: 401 });
    await expect(authenticatedFetch("/upload")).rejects.toThrow("User not authenticated");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });
});
