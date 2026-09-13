import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExportMemosSection from "@/components/Settings/ExportMemosSection";

const mocks = vi.hoisted(() => ({ getRequestToken: vi.fn(), toastError: vi.fn() }));
vi.mock("@/connect", () => ({ getRequestToken: mocks.getRequestToken }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.toastError } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const fetchMock = vi.fn();
const createObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRequestToken.mockResolvedValue("fresh-token");
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  createObjectURL.mockReturnValue("blob:export");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("memo export", () => {
  it("downloads the complete ZIP using refreshed credentials and blocks duplicate requests", async () => {
    let complete!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
    );
    const downloaded: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded.push(this);
    });
    const { unmount } = render(<ExportMemosSection />);
    fireEvent.click(screen.getByRole("button", { name: "setting.account.export-download" }));
    expect(screen.getByRole("button", { name: "setting.account.export-preparing" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/file/memos/export");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer fresh-token" }, credentials: "same-origin" });
    expect(createObjectURL).not.toHaveBeenCalled();
    const blob = new Blob(["zip bytes"], { type: "application/zip" });
    complete({ ok: true, blob: async () => blob } as Response);
    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(downloaded[0].download).toMatch(/^memos-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(downloaded[0].isConnected).toBe(false);
    expect(screen.getByRole("button")).toBeEnabled();
    unmount();
  });

  it.each([500, 401, 429])("shows an error instead of downloading an HTTP %s response", async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    render(<ExportMemosSection />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(status === 429 ? "setting.account.export-busy" : "setting.account.export-failed"),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("aborts work when leaving account settings", async () => {
    fetchMock.mockImplementation(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { unmount } = render(<ExportMemosSection />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
