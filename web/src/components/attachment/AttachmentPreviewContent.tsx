import { useMemo } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { AudioPreview } from "./previews/AudioPreview";
import { FallbackPreview } from "./previews/FallbackPreview";
import { ImagePreview } from "./previews/ImagePreview";
import { OfficePreview } from "./previews/OfficePreview";
import { PDFPreview } from "./previews/PDFPreview";
import { TextPreview } from "./previews/TextPreview";
import { VideoPreview } from "./previews/VideoPreview";
import { getPreviewType } from "./utils/mimeTypeResolver";

interface AttachmentPreviewContentProps {
  attachment: Attachment;
}

export function AttachmentPreviewContent({ attachment }: AttachmentPreviewContentProps) {
  const previewType = useMemo(() => getPreviewType(attachment.type, attachment.filename), [attachment.type, attachment.filename]);

  const src = getAttachmentUrl(attachment);
  const downloadUrl = src;

  // Render appropriate preview component
  switch (previewType) {
    case "image":
      return <ImagePreview src={src} alt={attachment.filename} />;

    case "video":
      return <VideoPreview src={src} type={attachment.type} />;

    case "audio":
      return <AudioPreview src={src} filename={attachment.filename} type={attachment.type} />;

    case "pdf":
      return <PDFPreview src={src} filename={attachment.filename} />;

    case "office":
      return <OfficePreview src={src} filename={attachment.filename} />;

    case "text":
    case "code":
      return <TextPreview src={src} filename={attachment.filename} />;

    case "fallback":
    default:
      return (
        <FallbackPreview filename={attachment.filename} type={attachment.type} size={Number(attachment.size)} downloadUrl={downloadUrl} />
      );
  }
}
