import { useAttachmentPreview } from "@/components/attachment";
import { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl, isMidiFile } from "@/utils/attachment";
import AttachmentIcon from "./AttachmentIcon";

interface Props {
  attachment: Attachment;
  allAttachments?: Attachment[];
  className?: string;
}

const MemoAttachment: React.FC<Props> = (props: Props) => {
  const { className, attachment, allAttachments = [] } = props;
  const attachmentUrl = getAttachmentUrl(attachment);
  const { openPreview } = useAttachmentPreview();

  const handleClick = () => {
    const attachmentsToUse = allAttachments.length > 0 ? allAttachments : [attachment];
    openPreview(attachment, attachmentsToUse);
  };

  return (
    <div
      className={`w-auto flex flex-row justify-start items-center text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-1 transition-colors ${className}`}
    >
      {attachment.type.startsWith("audio") && !isMidiFile(attachment.type) ? (
        <audio src={attachmentUrl} controls></audio>
      ) : (
        <>
          <AttachmentIcon className="w-4! h-4! mr-1" attachment={attachment} allAttachments={allAttachments} />
          <span className="text-sm max-w-[256px] truncate cursor-pointer" onClick={handleClick}>
            {attachment.filename}
          </span>
        </>
      )}
    </div>
  );
};

export default MemoAttachment;
