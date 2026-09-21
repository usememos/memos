import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebarProvider } from "@/contexts/AppSidebarContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { memoKeys } from "@/hooks/useMemoQueries";
import Attachments from "@/pages/Attachments";
import { AttachmentSchema, MotionMediaFamily, MotionMediaRole } from "@/types/proto/api/v1/attachment_service_pb";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import { UserSchema, UserSetting_TagsSettingSchema, UserSettingSchema } from "@/types/proto/api/v1/user_service_pb";

const clients = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listUserSettings: vi.fn(),
  listAttachments: vi.fn(),
  getMemo: vi.fn(),
  listSpaces: vi.fn(),
}));

// Keep the real page, providers, query hooks and media components. Only the
// RPC boundary, stored credential and presentation-only translations are replaced.
vi.mock("@/auth-state", () => ({ getAccessToken: () => "fixture-token", clearAccessToken: vi.fn() }));
vi.mock("@/connect", () => ({
  authServiceClient: { getCurrentUser: clients.getCurrentUser, signOut: vi.fn() },
  userServiceClient: { listUserSettings: clients.listUserSettings },
  attachmentServiceClient: { listAttachments: clients.listAttachments, batchDeleteAttachments: vi.fn() },
  memoServiceClient: { getMemo: clients.getMemo },
  spaceServiceClient: { listSpaces: clients.listSpaces },
  refreshAccessToken: vi.fn(),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/i18n", () => ({ default: { language: "en" } }));
vi.mock("@/hooks/useMediaQuery", () => ({ default: () => true }));

const attachment = (name: string, memo: string) =>
  create(AttachmentSchema, { name: `attachments/${name}`, filename: `${name}.png`, type: "image/png", memo });

const settings = (tags: Record<string, { blurContent: boolean }> = { "private.*": { blurContent: true } }) => ({
  settings: [
    create(UserSettingSchema, {
      name: "users/fixture/settings/TAGS",
      value: { case: "tagsSetting", value: create(UserSetting_TagsSettingSchema, { tags }) },
    }),
  ],
});

const Initialize = () => {
  const { initialize, isUserSettingsInitialized, refetchSettings } = useAuth();
  useEffect(() => void initialize(), [initialize]);
  return (
    <>
      <output data-testid="settings-ready">{String(isUserSettingsInitialized)}</output>
      <button type="button" onClick={() => void refetchSettings()}>
        refresh rules
      </button>
    </>
  );
};

const renderLibrary = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/attachments"]}>
          <SpaceProvider>
            <AppSidebarProvider>
              <Initialize />
              <Attachments />
            </AppSidebarProvider>
          </SpaceProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
};

const isBlurred = (image: HTMLElement) => image.closest(".blur-lg") !== null;

describe("attachment library tag-based blurring", () => {
  beforeEach(() => {
    clients.getCurrentUser.mockResolvedValue({ user: create(UserSchema, { name: "users/fixture", username: "fixture" }) });
    clients.listUserSettings.mockResolvedValue(settings());
    clients.listSpaces.mockResolvedValue({ spaces: [], nextPageToken: "" });
    clients.listAttachments.mockResolvedValue({
      attachments: [attachment("normal", "memos/normal"), attachment("private", "memos/private")],
      nextPageToken: "",
    });
    clients.getMemo.mockImplementation(async ({ name }: { name: string }) =>
      create(MemoSchema, { name, tags: name === "memos/private" ? ["private"] : [] }),
    );
  });

  it("applies memo rules to the real gallery and deduplicates lookups for attachments from the same memo", async () => {
    clients.listAttachments.mockResolvedValue({
      attachments: [attachment("normal", "memos/normal"), attachment("private", "memos/private"), attachment("second", "memos/private")],
      nextPageToken: "",
    });
    renderLibrary();
    const privateImage = await screen.findByAltText("private.png");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(2));
    expect(isBlurred(privateImage)).toBe(true);
    expect(isBlurred(screen.getByAltText("second.png"))).toBe(true);
    await waitFor(() => expect(isBlurred(screen.getByAltText("normal.png"))).toBe(false));

    const card = privateImage.closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(isBlurred(privateImage)).toBe(false);
    expect(isBlurred(screen.getByAltText("second.png"))).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not request memo details when no tag rule enables blurring", async () => {
    clients.listUserSettings.mockResolvedValue(settings({ private: { blurContent: false } }));
    renderLibrary();
    await screen.findByAltText("private.png");
    await waitFor(() => expect(screen.getByTestId("settings-ready")).toHaveTextContent("true"));
    expect(isBlurred(screen.getByAltText("private.png"))).toBe(false);
    expect(clients.getMemo).not.toHaveBeenCalled();
  });

  it("conceals previews while user tag settings are still loading", async () => {
    let resolveSettings!: (value: ReturnType<typeof settings>) => void;
    clients.listUserSettings.mockImplementation(() => new Promise((resolve) => (resolveSettings = resolve)));
    renderLibrary();
    const image = await screen.findByAltText("private.png");
    try {
      expect(screen.getByTestId("settings-ready")).toHaveTextContent("false");
      expect(isBlurred(image)).toBe(true);
      expect(clients.getMemo).not.toHaveBeenCalled();
    } finally {
      await act(async () => resolveSettings(settings()));
    }
  });

  it("conceals pending memo details, then evaluates the returned tags", async () => {
    let resolveMemo!: (value: Memo) => void;
    clients.getMemo.mockImplementation(() => new Promise((resolve) => (resolveMemo = resolve)));
    clients.listAttachments.mockResolvedValue({ attachments: [attachment("normal", "memos/normal")], nextPageToken: "" });
    renderLibrary();
    const image = await screen.findByAltText("normal.png");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(1));
    expect(isBlurred(image)).toBe(true);
    await act(async () => resolveMemo(create(MemoSchema, { name: "memos/normal", tags: [] })));
    await waitFor(() => expect(isBlurred(screen.getByAltText("normal.png"))).toBe(false));
  });

  it.each([
    Code.PermissionDenied,
    Code.NotFound,
    Code.Unavailable,
  ])("does not expose previews when memo lookup fails with code %s", async (code) => {
    clients.getMemo.mockRejectedValue(new ConnectError("not readable", code));
    const queryClient = renderLibrary();
    await screen.findByAltText("private.png");
    await waitFor(() => {
      const state = queryClient.getQueryState(memoKeys.detail("memos/private"));
      expect(state?.fetchStatus).toBe("idle");
      expect(state?.data === null || state?.status === "error").toBe(true);
    });
    expect(isBlurred(screen.getByAltText("private.png"))).toBe(true);
  });

  it("conceals stale cached metadata after its refresh fails", async () => {
    clients.listAttachments.mockResolvedValue({ attachments: [attachment("normal", "memos/normal")], nextPageToken: "" });
    clients.getMemo.mockRejectedValue(new ConnectError("offline", Code.Unavailable));
    const queryClient = renderLibrary();
    queryClient.setQueryData(memoKeys.detail("memos/normal"), create(MemoSchema, { name: "memos/normal", tags: [] }), {
      updatedAt: Date.now() - 30_000,
    });
    await screen.findByAltText("normal.png");
    await waitFor(() => expect(queryClient.getQueryState(memoKeys.detail("memos/normal"))?.status).toBe("error"));
    expect(isBlurred(screen.getByAltText("normal.png"))).toBe(true);
  });

  it("uses the same exact-key precedence and anchored patterns as memo blurring", async () => {
    clients.listUserSettings.mockResolvedValue(settings({ private: { blurContent: false }, "private.*": { blurContent: true } }));
    clients.getMemo.mockImplementation(async ({ name }: { name: string }) =>
      create(MemoSchema, { name, tags: name === "memos/private" ? ["private"] : ["private/child"] }),
    );
    renderLibrary();
    await screen.findByAltText("private.png");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(isBlurred(screen.getByAltText("private.png"))).toBe(false));
    expect(isBlurred(screen.getByAltText("normal.png"))).toBe(true);
  });

  it("keeps a blurred item concealed when navigating to it from an ordinary full-screen preview", async () => {
    renderLibrary();
    await screen.findByAltText("normal.png");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(isBlurred(screen.getByAltText("normal.png"))).toBe(false));
    fireEvent.click(screen.getByAltText("normal.png"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next item" }));
    const image = within(dialog).getByAltText("Preview image 2 of 2");
    expect(isBlurred(image)).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(isBlurred(image)).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Previous item" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next item" }));
    expect(isBlurred(within(dialog).getByAltText("Preview image 2 of 2"))).toBe(true);
  });

  it("requires a new reveal after a blur rule is disabled and enabled again", async () => {
    renderLibrary();
    await screen.findByAltText("private.png");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(2));
    const card = screen.getByAltText("private.png").closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(isBlurred(screen.getByAltText("private.png"))).toBe(false);

    clients.listUserSettings.mockResolvedValue(settings({}));
    fireEvent.click(screen.getByRole("button", { name: "refresh rules" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "memo.click-to-show-sensitive-content" })).not.toBeInTheDocument());
    clients.listUserSettings.mockResolvedValue(settings());
    fireEvent.click(screen.getByRole("button", { name: "refresh rules" }));
    await waitFor(() => expect(isBlurred(screen.getByAltText("private.png"))).toBe(true));
  });

  it("does not mount a playable full-screen video before explicit reveal", async () => {
    clients.listAttachments.mockResolvedValue({
      attachments: [create(AttachmentSchema, { name: "attachments/clip", filename: "clip.mp4", type: "video/mp4", memo: "memos/private" })],
      nextPageToken: "",
    });
    renderLibrary();
    await screen.findByRole("img", { name: "clip.mp4" });
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    fireEvent.click(screen.getByRole("img", { name: "clip.mp4" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("video[controls], video[autoplay]")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(dialog.querySelector("video[controls][autoplay]")).not.toBeNull();
  });

  it("considers both memos of a paired live photo and keeps its playback control concealed", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    clients.listAttachments.mockResolvedValue({
      attachments: [
        create(AttachmentSchema, {
          name: "attachments/live-still",
          filename: "live.jpg",
          type: "image/jpeg",
          memo: "memos/normal",
          motionMedia: { family: MotionMediaFamily.APPLE_LIVE_PHOTO, role: MotionMediaRole.STILL, groupId: "live" },
        }),
        create(AttachmentSchema, {
          name: "attachments/live-video",
          filename: "live.mov",
          type: "video/quicktime",
          memo: "memos/private",
          motionMedia: { family: MotionMediaFamily.APPLE_LIVE_PHOTO, role: MotionMediaRole.VIDEO, groupId: "live" },
        }),
      ],
      nextPageToken: "",
    });
    renderLibrary();
    await screen.findByAltText("live.jpg");
    await waitFor(() => expect(clients.getMemo).toHaveBeenCalledTimes(2));
    expect(isBlurred(screen.getByAltText("live.jpg"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Hover or press to play live photo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(screen.getByRole("button", { name: "Hover or press to play live photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByAltText("live.jpg"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Hover or press to play live photo" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "memo.click-to-show-sensitive-content" }));
    expect(within(dialog).getByRole("button", { name: "Hover or press to play live photo" })).toBeInTheDocument();
  });
});
