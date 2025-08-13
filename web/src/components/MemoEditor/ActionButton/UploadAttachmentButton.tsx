import { t } from "i18next";
import { LoaderIcon, PaperclipIcon } from "lucide-react";
import mime from "mime";
import { observer } from "mobx-react-lite";
import { useContext, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { attachmentStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { MemoEditorContext } from "../types";

interface Props {
  isUploading?: boolean;
}

interface State {
  uploadingFlag: boolean;
}

const UploadAttachmentButton = observer((props: Props) => {
  const context = useContext(MemoEditorContext);
  const [state, setState] = useState<State>({
    uploadingFlag: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      return;
    }
    if (state.uploadingFlag) {
      return;
    }

    setState((state) => {
      return {
        ...state,
        uploadingFlag: true,
      };
    });

    const createdAttachmentList: Attachment[] = [];
    try {
      if (!fileInputRef.current || !fileInputRef.current.files) {
        return;
      }
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
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    context.setAttachmentList([...context.attachmentList, ...createdAttachmentList]);
    setState((state) => {
      return {
        ...state,
        uploadingFlag: false,
      };
    });
  };

  const isUploading = state.uploadingFlag || props.isUploading;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button className="relative" variant="ghost" size="icon" disabled={isUploading}>
            {isUploading ? <LoaderIcon className="size-5 animate-spin" /> : <PaperclipIcon className="size-5" />}
            <input
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              ref={fileInputRef}
              disabled={isUploading}
              onChange={handleFileInputChange}
              type="file"
              id="files"
              multiple={true}
              accept="*"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("tooltip.upload-attachment")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default UploadAttachmentButton;
