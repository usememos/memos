import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";

interface AttachmentCardProps {
  attachment: Attachment;
  onClick?: () => void;
  className?: string;
}

const AttachmentCard = ({ attachment, onClick, className }: AttachmentCardProps) => {
  const attachmentType = getAttachmentType(attachment);
  const sourceUrl = getAttachmentUrl(attachment);

  if (attachmentType === "image/*") {
    return (
      <img
        src={sourceUrl}
        alt={attachment.filename}
        className={cn("w-full h-full object-cover rounded-lg cursor-pointer", className)}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  if (attachmentType === "video/*") {
    return <video src={sourceUrl} className={cn("w-full h-full object-cover rounded-lg", className)} controls preload="metadata" />;
  }

  return null;
};

export default AttachmentCard;
