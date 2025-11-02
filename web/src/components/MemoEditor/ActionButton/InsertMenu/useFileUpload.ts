import mime from "mime";
import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { attachmentStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";

export const useFileUpload = (onUploadComplete: (attachments: Attachment[]) => void) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFlag, setUploadingFlag] = useState(false);

  const handleFileInputChange = async () => {
    if (!fileInputRef.current?.files || fileInputRef.current.files.length === 0 || uploadingFlag) {
      return;
    }

    setUploadingFlag(true);
    const createdAttachmentList: Attachment[] = [];

    try {
      for (const file of fileInputRef.current.files) {
        const { name: filename, size, type } = file;
        const buffer = new Uint8Array(await file.arrayBuffer());
        const attachment = await attachmentStore.createAttachment({
          attachment: Attachment.fromPartial({
            filename,
            size,
            type: type || mime.getType(filename) || "text/plain",
            content: buffer,
          }),
          attachmentId: "",
        });
        createdAttachmentList.push(attachment);
      }
      onUploadComplete(createdAttachmentList);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    } finally {
      setUploadingFlag(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    uploadingFlag,
    handleFileInputChange,
    handleUploadClick,
  };
};
