import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AttachmentDocumentRows } from "@/components/AttachmentLibrary/AttachmentFileRows";
import AttachmentMediaGrid from "@/components/AttachmentLibrary/AttachmentMediaGrid";
import type { AttachmentLibraryMonthGroup } from "@/hooks/useAttachmentLibrary";
import { AttachmentSchema, MediaMetadataSchema, VideoMetadataSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { UserSchema } from "@/types/proto/api/v1/user_service_pb";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const LocationStateProbe = () => {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify(location.state)}</output>;
};

describe("<AttachmentMediaGrid>", () => {
  it("links a media attachment to its source memo without replacing the direct file action", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/photo",
      filename: "photo.jpg",
      type: "image/jpeg",
      memo: "memos/source-memo",
      creator: "users/steven",
    });
    const creator = create(UserSchema, { name: "users/steven", username: "steven", displayName: "Steven" });
    const groups: AttachmentLibraryMonthGroup[] = [
      {
        key: "2026-07",
        label: "Jul 2026",
        items: [
          {
            id: attachment.name,
            kind: "image",
            filename: attachment.filename,
            posterUrl: "/file/attachments/photo/photo.jpg?thumbnail=1",
            sourceUrl: "/file/attachments/photo/photo.jpg",
            attachmentNames: [attachment.name],
            attachments: [attachment],
            previewItem: {
              id: attachment.name,
              kind: "image",
              filename: attachment.filename,
              sourceUrl: "/file/attachments/photo/photo.jpg",
            },
            mimeType: attachment.type,
            primaryAttachment: attachment,
            createdLabel: "Jul 29, 2026",
            fileTypeLabel: "JPEG",
            memoName: attachment.memo,
          },
        ],
      },
    ];
    const onPreview = vi.fn();

    render(
      <MemoryRouter initialEntries={["/spaces/product/attachments?filter=tagSearch%3Awork"]}>
        <AttachmentMediaGrid groups={groups} creators={new Map([[creator.name, creator]])} onPreview={onPreview} />
        <LocationStateProbe />
      </MemoryRouter>,
    );

    const memoLink = screen.getByRole("link", { name: "attachment-library.labels.memo" });
    expect(memoLink).toHaveAttribute("href", "/memos/source-memo");
    expect(screen.getByRole("link", { name: "Steven" })).toHaveAttribute("href", "/?creator=steven");

    const fileLink = screen.getByRole("link", { name: "attachment-library.actions.open" });
    expect(fileLink).toHaveAttribute("href", "/file/attachments/photo/photo.jpg");
    expect(fileLink).toHaveAttribute("target", "_blank");

    fireEvent.click(memoLink);
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.getByTestId("location-state")).toHaveTextContent('{"from":"/spaces/product/attachments?filter=tagSearch%3Awork"}');
  });

  it("shows the uploader on document rows", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/document",
      filename: "plan.pdf",
      type: "application/pdf",
      creator: "users/steven",
      memo: "memos/source-memo",
    });

    render(
      <MemoryRouter>
        <AttachmentDocumentRows
          items={[{ attachment, createdLabel: "Jul 29, 2026", fileTypeLabel: "PDF", memoName: attachment.memo, sourceUrl: "/plan.pdf" }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "steven" })).toHaveAttribute("href", "/?creator=steven");
  });

  it("keeps video duration inside the existing play badge", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/video",
      filename: "clip.mp4",
      type: "video/mp4",
      memo: "memos/source-memo",
      mediaMetadata: create(MediaMetadataSchema, {
        details: {
          case: "video",
          value: create(VideoMetadataSchema, { durationSeconds: 12.5 }),
        },
      }),
    });
    const groups: AttachmentLibraryMonthGroup[] = [
      {
        key: "2026-07",
        label: "Jul 2026",
        items: [
          {
            id: attachment.name,
            kind: "video",
            filename: attachment.filename,
            posterUrl: "/poster.jpg",
            sourceUrl: "/clip.mp4",
            attachmentNames: [attachment.name],
            attachments: [attachment],
            previewItem: {
              id: attachment.name,
              kind: "video",
              filename: attachment.filename,
              sourceUrl: "/clip.mp4",
              attachments: [attachment],
            },
            mimeType: attachment.type,
            primaryAttachment: attachment,
            createdLabel: "Jul 29, 2026",
            fileTypeLabel: "MP4",
            memoName: attachment.memo,
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <AttachmentMediaGrid groups={groups} onPreview={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("0:13")).toBeInTheDocument();
  });
});
