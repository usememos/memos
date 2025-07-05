import { memo } from "react";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "./MemoAttachment";
import showPreviewImageDialog from "./PreviewImageDialog";

const MemoAttachmentListView = ({ attachments = [] }: { attachments: Attachment[] }) => {
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
    showPreviewImageDialog(imgUrls, index);
  };

  const MediaCard = ({ attachment, className }: { attachment: Attachment; className?: string }) => {
    const type = getAttachmentType(attachment);
    const attachmentUrl = getAttachmentUrl(attachment);

    if (type === "image/*") {
      return (
        <img
          className={cn("cursor-pointer h-full w-auto rounded-lg border border-border object-contain hover:opacity-80", className)}
          src={attachment.externalLink ? attachmentUrl : attachmentUrl + "?thumbnail=true"}
          onClick={() => handleImageClick(attachmentUrl)}
          decoding="async"
          loading="lazy"
        />
      );
    } else if (type === "video/*") {
      return (
        <video
          className={cn("cursor-pointer h-full w-auto rounded-lg border border-border object-contain bg-popover", className)}
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
      <div key={attachment.name} className="max-w-[70%] grow flex flex-col justify-start items-start shrink-0">
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
    </>
  );
};

export default memo(MemoAttachmentListView);
