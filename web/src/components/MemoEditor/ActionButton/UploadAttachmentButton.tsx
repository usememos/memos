import { t } from "i18next";
import { LoaderIcon, PaperclipIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    try {
      // Delegate to editor's upload handler so progress UI is consistent
      if (context.uploadFiles) {
        await context.uploadFiles(fileInputRef.current.files);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
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
