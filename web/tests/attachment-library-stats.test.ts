import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAttachmentLibraryStats, useAttachmentLibraryStats, useUnusedAttachmentLibrary } from "@/hooks/useAttachmentLibrary";
import {
  type Attachment,
  AttachmentSchema,
  MotionMediaFamily,
  MotionMediaRole,
  MotionMediaSchema,
} from "@/types/proto/api/v1/attachment_service_pb";

const clients = vi.hoisted(() => ({ listAttachments: vi.fn() }));

vi.mock("@/connect", () => ({
  attachmentServiceClient: { listAttachments: clients.listAttachments },
}));

const attachment = (name: string, type: string, memo?: string): Attachment =>
  create(AttachmentSchema, { name: `attachments/${name}`, filename: name, type, memo });

describe("buildAttachmentLibraryStats", () => {
  beforeEach(() => clients.listAttachments.mockReset());

  it("counts linked attachment types without expanding live-photo pairs", () => {
    const still = attachment("live.jpg", "image/jpeg", "memos/one");
    still.motionMedia = create(MotionMediaSchema, {
      family: MotionMediaFamily.APPLE_LIVE_PHOTO,
      role: MotionMediaRole.STILL,
      groupId: "live-photo",
    });
    const video = attachment("live.mov", "video/quicktime", "memos/one");
    video.motionMedia = create(MotionMediaSchema, {
      family: MotionMediaFamily.APPLE_LIVE_PHOTO,
      role: MotionMediaRole.VIDEO,
      groupId: "live-photo",
    });

    expect(
      buildAttachmentLibraryStats([
        still,
        video,
        attachment("photo.png", "image/png", "memos/one"),
        attachment("recording.mp3", "audio/mpeg", "memos/one"),
        attachment("notes.pdf", "application/pdf", "memos/one"),
        attachment("unused.png", "image/png"),
      ]),
    ).toEqual({
      unused: 1,
      media: 2,
      documents: 1,
      audio: 1,
    });
  });

  it("loads every page before exposing complete sidebar counts", async () => {
    clients.listAttachments
      .mockResolvedValueOnce({
        attachments: [attachment("photo.png", "image/png", "memos/one")],
        nextPageToken: "1000",
      })
      .mockResolvedValueOnce({
        attachments: [attachment("unused.pdf", "application/pdf")],
        nextPageToken: "",
      });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: queryClient }, children);
    const filter = 'space == "spaces/team"';
    const { result } = renderHook(() => useAttachmentLibraryStats(filter), { wrapper });

    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(result.current.stats).toEqual({ media: 1, documents: 0, audio: 0, unused: 1 });
    expect(clients.listAttachments).toHaveBeenCalledTimes(2);
    expect(clients.listAttachments.mock.calls.map(([request]) => request.filter)).toEqual([filter, filter]);
  });

  it("uses only the unused predicate in the All collection", async () => {
    clients.listAttachments.mockResolvedValue({ attachments: [], nextPageToken: "" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useUnusedAttachmentLibrary("en", undefined), { wrapper });

    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(clients.listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: "(memo_id == null)",
      }),
    );
  });

  it("combines an explicit unassigned filter with the unused attachment predicate", async () => {
    clients.listAttachments.mockResolvedValue({ attachments: [], nextPageToken: "" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: queryClient }, children);
    const filter = "space == null";
    const { result } = renderHook(() => useUnusedAttachmentLibrary("en", filter), { wrapper });

    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(clients.listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: "(memo_id == null) && (space == null)",
      }),
    );
  });
});
