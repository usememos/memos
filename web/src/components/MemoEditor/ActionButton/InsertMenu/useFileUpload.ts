import { useRef, useState } from "react";
import type { LocalFile } from "@/components/memo-metadata";

export const useFileUpload = (onFilesSelected: (localFiles: LocalFile[]) => void) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectingFlag, setSelectingFlag] = useState(false);

  const handleFileInputChange = (event?: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(fileInputRef.current?.files || event?.target.files || []);
    if (files.length === 0 || selectingFlag) {
      return;
    }
    setSelectingFlag(true);
    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    onFilesSelected(localFiles);
    setSelectingFlag(false);
    // Optionally clear input value to allow re-selecting the same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    selectingFlag,
    handleFileInputChange,
    handleUploadClick,
  };
};
