import { AlertTriangle, Download, ExternalLink, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { useState } from "react";

interface OfficePreviewProps {
  src: string;
  filename: string;
  isLoading?: boolean;
}

// Get the file type icon based on extension
function getOfficeIcon(filename: string) {
  const ext = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "ppt":
    case "pptx":
      return Presentation;
    case "xls":
    case "xlsx":
      return FileSpreadsheet;
    case "doc":
    case "docx":
    default:
      return FileText;
  }
}

// Get friendly file type name
function getOfficeTypeName(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "ppt":
    case "pptx":
      return "PowerPoint";
    case "xls":
    case "xlsx":
      return "Excel";
    case "doc":
    case "docx":
      return "Word";
    default:
      return "Office";
  }
}

export function OfficePreview({ src, filename, isLoading }: OfficePreviewProps) {
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Build the absolute URL for the file
  // Microsoft Office Online Viewer requires a publicly accessible URL
  const getAbsoluteUrl = (relativeSrc: string): string => {
    // If already absolute, return as-is
    if (relativeSrc.startsWith("http://") || relativeSrc.startsWith("https://")) {
      return relativeSrc;
    }
    // Build absolute URL from current origin
    const origin = window.location.origin;
    return `${origin}${relativeSrc.startsWith("/") ? "" : "/"}${relativeSrc}`;
  };

  const absoluteUrl = getAbsoluteUrl(src);
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;

  const Icon = getOfficeIcon(filename);
  const typeName = getOfficeTypeName(filename);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Show warning/fallback for localhost or private networks
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isPrivateNetwork =
    window.location.hostname.startsWith("192.168.") ||
    window.location.hostname.startsWith("10.") ||
    window.location.hostname.endsWith(".local");

  if (isLocalhost || isPrivateNetwork) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="text-center max-w-md">
          <h3 className="text-lg font-medium text-foreground mb-2">Cannot Preview {typeName} File</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Microsoft Office Online Viewer requires the file to be publicly accessible on the internet. Your server is
            running on a local/private network.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">{filename}</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={src}
              download={filename}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open in new tab
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-sm">
          To enable preview, deploy your Memos instance to a public URL or download the file to view locally.
        </p>
      </div>
    );
  }

  // Show error state if iframe failed
  if (iframeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">Preview Failed</h3>
          <p className="text-muted-foreground text-sm">Unable to load {typeName} preview. The file may not be accessible.</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={src}
            download={filename}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <a
            href={viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Office Online
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Loading indicator */}
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Loading {typeName} preview...</p>
          </div>
        </div>
      )}

      {/* Microsoft Office Online Viewer iframe */}
      <iframe
        src={viewerUrl}
        title={filename}
        className="w-full h-full border-0"
        onLoad={() => setIframeLoaded(true)}
        onError={() => setIframeError(true)}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
