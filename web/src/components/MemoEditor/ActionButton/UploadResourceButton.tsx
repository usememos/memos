import { Button } from "@usememos/mui";
import { LoaderIcon, PaperclipIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resourceStore } from "@/store/v2";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { MemoEditorContext } from "../types";

interface Props {
  isUploadingResource?: boolean;
}

interface State {
  uploadingFlag: boolean;
}

const UploadResourceButton = observer((props: Props) => {
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

    const createdResourceList: Resource[] = [];
    try {
      if (!fileInputRef.current || !fileInputRef.current.files) {
        return;
      }
      for (const file of fileInputRef.current.files) {
        const { name: filename, size, type } = file;
        const buffer = new Uint8Array(await file.arrayBuffer());
        const resource = await resourceStore.createResource({
          resource: Resource.fromPartial({
            filename,
            size,
            type,
            content: buffer,
          }),
        });
        createdResourceList.push(resource);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    context.setResourceList([...context.resourceList, ...createdResourceList]);
    setState((state) => {
      return {
        ...state,
        uploadingFlag: false,
      };
    });
  };

  const isUploading = state.uploadingFlag || props.isUploadingResource;

  return (
    <Button className="relative p-0" variant="plain" disabled={isUploading}>
      {isUploading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <PaperclipIcon className="w-5 h-5" />}
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
  );
});

export default UploadResourceButton;
