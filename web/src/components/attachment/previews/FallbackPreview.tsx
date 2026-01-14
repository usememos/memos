import { Download, FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface FallbackPreviewProps {
  filename: string;
  type: string;
  size: number;
  downloadUrl: string;
}

export function FallbackPreview({ filename, type, size, downloadUrl }: FallbackPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      {/* File icon */}
      <div className="w-24 h-24 bg-muted rounded-2xl flex items-center justify-center">
        <FileIcon className="w-12 h-12 text-muted-foreground" />
      </div>

      {/* File info */}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground mb-1">{filename}</p>
        <p className="text-sm text-muted-foreground">
          {type} • {formatFileSize(size)}
        </p>
      </div>

      {/* Message */}
      <p className="text-muted-foreground text-center max-w-md">
        Preview is not available for this file type. You can download it to view locally.
      </p>

      {/* Download button */}
      <a
        href={downloadUrl}
        download={filename}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Download className="w-5 h-5" />
        Download File
      </a>
    </div>
  );
}
