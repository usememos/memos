import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AttachmentMediaGrid from "@/components/AttachmentLibrary/AttachmentMediaGrid";
import type { AttachmentLibraryMonthGroup } from "@/hooks/useAttachmentLibrary";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("<AttachmentMediaGrid>", () => {
  it("links a media attachment to its source memo without replacing the direct file action", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/photo",
      filename: "photo.jpg",
      type: "image/jpeg",
      memo: "memos/source-memo",
    });
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
      <MemoryRouter>
        <AttachmentMediaGrid groups={groups} onPreview={onPreview} />
      </MemoryRouter>,
    );

    const memoLink = screen.getByRole("link", { name: "attachment-library.labels.memo" });
    expect(memoLink).toHaveAttribute("href", "/memos/source-memo");

    const fileLink = screen.getByRole("link", { name: "attachment-library.actions.open" });
    expect(fileLink).toHaveAttribute("href", "/file/attachments/photo/photo.jpg");
    expect(fileLink).toHaveAttribute("target", "_blank");

    fireEvent.click(memoLink);
    expect(onPreview).not.toHaveBeenCalled();
  });
});
