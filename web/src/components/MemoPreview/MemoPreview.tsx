import { create } from "@bufbuild/protobuf";
import { FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoContent from "../MemoContent";
import { MemoViewContext, type MemoViewContextValue } from "../MemoView/MemoViewContext";

interface MemoPreviewProps {
  content: string;
  attachments: Attachment[];
  compact?: boolean;
  className?: string;
}

const STUB_CONTEXT: MemoViewContextValue = {
  memo: create(MemoSchema),
  creator: undefined,
  currentUser: undefined,
  parentPage: "/",
  isArchived: false,
  readonly: true,
  showNSFWContent: false,
  nsfw: false,
};

const AttachmentThumbnails = ({ attachments }: { attachments: Attachment[] }) => {
  const images: Attachment[] = [];
  const others: Attachment[] = [];
  for (const a of attachments) {
    if (getAttachmentType(a) === "image/*") images.push(a);
    else others.push(a);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {images.map((a) => (
        <img
          key={a.name}
          src={getAttachmentUrl(a)}
          alt={a.filename}
          className="w-10 h-10 rounded border border-border object-cover bg-muted/40"
          loading="lazy"
        />
      ))}
      {others.map((a) => (
        <div key={a.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <FileIcon className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[80px]">{a.filename}</span>
        </div>
      ))}
    </div>
  );
};

const MemoPreview = ({ content, attachments, compact = true, className }: MemoPreviewProps) => {
  const hasContent = content.trim().length > 0;
  const hasAttachments = attachments.length > 0;

  if (!hasContent && !hasAttachments) {
    return null;
  }

  return (
    <MemoViewContext.Provider value={STUB_CONTEXT}>
      <div className={cn("flex flex-col gap-1 pointer-events-none", className)}>
        {hasContent && <MemoContent content={content} compact={compact} />}
        {hasAttachments && <AttachmentThumbnails attachments={attachments} />}
      </div>
    </MemoViewContext.Provider>
  );
};

export default MemoPreview;
