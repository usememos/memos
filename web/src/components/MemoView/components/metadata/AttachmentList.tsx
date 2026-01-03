import { useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "../../../MemoAttachment";
import PreviewImageDialog from "../../../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";

interface AttachmentListProps {
  attachments: Attachment[];
}

function separateMediaAndDocs(attachments: Attachment[]): { media: Attachment[]; docs: Attachment[] } {
  const media: Attachment[] = [];
  const docs: Attachment[] = [];

  for (const attachment of attachments) {
    const attachmentType = getAttachmentType(attachment);
    if (attachmentType === "image/*" || attachmentType === "video/*") {
      media.push(attachment);
    } else {
      docs.push(attachment);
    }
  }

  return { media, docs };
}

const AttachmentList = ({ attachments }: AttachmentListProps) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number; mimeType?: string }>({
    open: false,
    urls: [],
    index: 0,
    mimeType: undefined,
  });

  const handleImageClick = (imgUrl: string, mediaAttachments: Attachment[]) => {
    const imageAttachments = mediaAttachments.filter((attachment) => getAttachmentType(attachment) === "image/*");
    const imgUrls = imageAttachments.map((attachment) => getAttachmentUrl(attachment));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    const mimeType = imageAttachments[index]?.type;
    setPreviewImage({ open: true, urls: imgUrls, index, mimeType });
  };

  const { media: mediaItems, docs: docItems } = separateMediaAndDocs(attachments);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      {mediaItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {mediaItems.map((attachment) => (
            <div key={attachment.name} className="max-w-[60%] w-fit flex flex-col justify-start items-start shrink-0">
              <AttachmentCard
                attachment={attachment}
                onClick={() => {
                  handleImageClick(getAttachmentUrl(attachment), mediaItems);
                }}
                className="max-h-64 grow"
              />
            </div>
          ))}
        </div>
      )}

      {docItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {docItems.map((attachment) => (
            <MemoAttachment key={attachment.name} attachment={attachment} />
          ))}
        </div>
      )}

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open: boolean) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
        mimeType={previewImage.mimeType}
      />
    </>
  );
};

export default AttachmentList;
