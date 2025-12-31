import { useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "../MemoAttachment";
import PreviewImageDialog from "../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import { separateMediaAndDocs, toAttachmentItems } from "./types";

interface AttachmentListProps {
  attachments: Attachment[];
}

const AttachmentList = ({ attachments }: AttachmentListProps) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });

  const handleImageClick = (imgUrl: string, mediaAttachments: Attachment[]) => {
    const imgUrls = mediaAttachments
      .filter((attachment) => getAttachmentType(attachment) === "image/*")
      .map((attachment) => getAttachmentUrl(attachment));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    setPreviewImage({ open: true, urls: imgUrls, index });
  };

  const items = toAttachmentItems(attachments, []);
  const { media: mediaItems, docs: docItems } = separateMediaAndDocs(items);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      {mediaItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {mediaItems.map((item) => (
            <div key={item.id} className="max-w-[60%] w-fit flex flex-col justify-start items-start shrink-0">
              <AttachmentCard
                item={item}
                mode="view"
                onClick={() => {
                  handleImageClick(item.sourceUrl, attachments);
                }}
                className="max-h-64 grow"
              />
            </div>
          ))}
        </div>
      )}

      {docItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {docItems.map((item) => {
            const attachment = attachments.find((a) => a.name === item.id);
            return attachment ? <MemoAttachment key={item.id} attachment={attachment} /> : null;
          })}
        </div>
      )}

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default AttachmentList;
