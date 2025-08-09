import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentUrl, isMidiFile } from "@/utils/attachment";
import AttachmentIcon from "./AttachmentIcon";

interface Props {
  attachment: Attachment;
  className?: string;
}

const MemoAttachment: React.FC<Props> = (props: Props) => {
  const { className, attachment } = props;
  const attachmentUrl = getAttachmentUrl(attachment);

  const handlePreviewBtnClick = () => {
    window.open(attachmentUrl);
  };

  return (
    <div
      className={`w-auto flex flex-row justify-start items-center text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-1 transition-colors ${className}`}
    >
      {attachment.type.startsWith("audio") && !isMidiFile(attachment.type) ? (
        <audio src={attachmentUrl} controls></audio>
      ) : (
        <>
          <AttachmentIcon className="w-4! h-4! mr-1" attachment={attachment} />
          <span className="text-sm max-w-[256px] truncate cursor-pointer" onClick={handlePreviewBtnClick}>
            {attachment.filename}
          </span>
        </>
      )}
    </div>
  );
};

export default MemoAttachment;
