import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "./MemoAttachment";
import PreviewImageDialog from "./PreviewImageDialog";

const MemoAttachmentListView = ({ attachments = [] }: { attachments: Attachment[] }) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });
  const mediaAttachments: Attachment[] = [];
  const otherAttachments: Attachment[] = [];

  attachments.forEach((attachment) => {
    const type = getAttachmentType(attachment);
    if (type === "image/*" || type === "video/*") {
      mediaAttachments.push(attachment);
      return;
    }

    otherAttachments.push(attachment);
  });

  const handleImageClick = (imgUrl: string) => {
    const imgUrls = mediaAttachments
      .filter((attachment) => getAttachmentType(attachment) === "image/*")
      .map((attachment) => getAttachmentUrl(attachment));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    setPreviewImage({ open: true, urls: imgUrls, index });
  };

  const MediaCard = ({ attachment, className }: { attachment: Attachment; className?: string }) => {
    const type = getAttachmentType(attachment);
    const attachmentUrl = getAttachmentUrl(attachment);
    const attachmentThumbnailUrl = getAttachmentThumbnailUrl(attachment);

    if (type === "image/*") {
      return (
        <img
          className={cn("cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain transition-colors", className)}
          src={attachmentThumbnailUrl}
          onError={(e) => {
            // Fallback to original image if thumbnail fails
            const target = e.target as HTMLImageElement;
            if (target.src.includes("?thumbnail=true")) {
              console.warn("Thumbnail failed, falling back to original image:", attachmentUrl);
              target.src = attachmentUrl;
            }
          }}
          onClick={() => handleImageClick(attachmentUrl)}
          decoding="async"
          loading="lazy"
        />
      );
    } else if (type === "video/*") {
      return (
        <video
          className={cn(
            "cursor-pointer h-full w-auto rounded-lg border border-border/60 object-contain bg-muted transition-colors",
            className,
          )}
          preload="metadata"
          crossOrigin="anonymous"
          src={attachmentUrl}
          controls
        />
      );
    } else {
      return <></>;
    }
  };

  const MediaList = ({ attachments = [] }: { attachments: Attachment[] }) => {
    const cards = attachments.map((attachment) => (
      <div key={attachment.name} className="max-w-[60%] w-fit flex flex-col justify-start items-start shrink-0">
        <MediaCard className="max-h-64 grow" attachment={attachment} />
      </div>
    ));

    return <div className="w-full flex flex-row justify-start overflow-auto gap-2">{cards}</div>;
  };

  const OtherList = ({ attachments = [] }: { attachments: Attachment[] }) => {
    if (attachments.length === 0) return <></>;

    return (
      <div className="w-full flex flex-row justify-start overflow-auto gap-2">
        {otherAttachments.map((attachment) => (
          <MemoAttachment key={attachment.name} attachment={attachment} />
        ))}
      </div>
    );
  };

  return (
    <>
      {mediaAttachments.length > 0 && <MediaList attachments={mediaAttachments} />}
      <OtherList attachments={otherAttachments} />

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default memo(MemoAttachmentListView);
