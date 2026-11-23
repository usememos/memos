import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaMetadataDetails from "@/components/MediaMetadataDetails";
import { AttachmentSchema, MediaLocationSchema, MediaMetadataSchema, PhotoMetadataSchema } from "@/types/proto/api/attachment_service_pb";
import type { PreviewMediaItem } from "@/utils/media-item";

const copyToClipboard = vi.hoisted(() => vi.fn());

vi.mock("copy-to-clipboard", () => ({ default: copyToClipboard }));
vi.mock("@/i18n", () => ({ default: { language: "en" } }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const createPhotoItem = (id: string, latitude: number, longitude: number): PreviewMediaItem => {
  const attachment = create(AttachmentSchema, {
    name: `attachments/${id}`,
    filename: `${id}.jpg`,
    type: "image/jpeg",
    mediaMetadata: create(MediaMetadataSchema, {
      details: {
        case: "photo",
        value: create(PhotoMetadataSchema, {
          location: create(MediaLocationSchema, { latitude, longitude }),
        }),
      },
    }),
  });

  return {
    id,
    kind: "image",
    filename: attachment.filename,
    sourceUrl: `/file/${attachment.name}/${attachment.filename}`,
    attachments: [attachment],
  };
};

describe("MediaMetadataDetails", () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies photo coordinates when the Clipboard API is unavailable over plain HTTP", async () => {
    // navigator.clipboard exists only in secure contexts; jsdom omits it, matching
    // self-hosted http:// deployments where copying coordinates silently did nothing.
    copyToClipboard.mockResolvedValue(true);

    render(<MediaMetadataDetails id="details" item={createPhotoItem("photo-1", 37.7749, -122.4194)} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));

    expect(copyToClipboard).toHaveBeenCalledWith("37.7749, -122.4194");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "attachment-details.actions.copied" }).querySelector("svg.lucide-check")).not.toBeNull();
    });
  });

  it("does not show the copied state when the copy fails", async () => {
    copyToClipboard.mockResolvedValue(false);

    render(<MediaMetadataDetails id="details" item={createPhotoItem("photo-1", 37.7749, -122.4194)} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));

    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith("37.7749, -122.4194"));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "attachment-details.actions.copied" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }).querySelector("svg.lucide-check"),
    ).toBeNull();
  });

  it("clears the pending copied reset timer when switching to another photo", async () => {
    vi.useFakeTimers();
    copyToClipboard.mockResolvedValue(true);
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { rerender } = render(
      <MediaMetadataDetails id="details" item={createPhotoItem("photo-1", 37.7749, -122.4194)} onClose={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "attachment-details.actions.copied" })).toBeInTheDocument();

    clearTimeoutSpy.mockClear();
    rerender(<MediaMetadataDetails id="details" item={createPhotoItem("photo-2", 40.7128, -74.006)} onClose={vi.fn()} />);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" })).toBeInTheDocument();
  });

  it("ignores a copy that resolves after switching to another photo", async () => {
    let resolveCopy!: (value: boolean) => void;
    copyToClipboard.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveCopy = resolve;
        }),
    );

    const { rerender } = render(
      <MediaMetadataDetails id="details" item={createPhotoItem("photo-1", 37.7749, -122.4194)} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));
    rerender(<MediaMetadataDetails id="details" item={createPhotoItem("photo-2", 40.7128, -74.006)} onClose={vi.fn()} />);

    await act(async () => {
      resolveCopy(true);
      await Promise.resolve();
    });

    expect(screen.queryByRole("button", { name: "attachment-details.actions.copied" })).toBeNull();
    expect(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" })).toBeInTheDocument();
  });

  it("resets the copied state after 1600ms and clears timers on unmount", async () => {
    vi.useFakeTimers();
    copyToClipboard.mockResolvedValue(true);
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { unmount } = render(
      <MediaMetadataDetails id="details" item={createPhotoItem("photo-1", 37.7749, -122.4194)} onClose={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "attachment-details.actions.copied" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "attachment-details.actions.copy-coordinates" }));
      await Promise.resolve();
    });
    clearTimeoutSpy.mockClear();
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
