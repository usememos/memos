import { create } from "@bufbuild/protobuf";
import { FileIcon } from "lucide-react";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoContent from "../MemoContent";
import { MemoViewContext, type MemoViewContextValue } from "../MemoView/MemoViewContext";

interface MemoPreviewProps {
  content: string;
  attachments: Attachment[];
  name?: string;
  compact?: boolean;
  className?: string;
  creator?: User;
  showCreator?: boolean;
  showMemoId?: boolean;
  truncate?: boolean;
}

const STUB_CONTEXT: MemoViewContextValue = {
  memo: create(MemoSchema),
  creator: undefined,
  currentUser: undefined,
  parentPage: "/",
  isArchived: false,
  readonly: true,
  showBlurredContent: false,
  blurred: false,
  openEditor: () => {},
  toggleBlurVisibility: () => {},
  openPreview: () => {},
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

const PreviewMeta = ({
  creator,
  showCreator,
  memoName,
  showMemoId,
}: {
  creator?: User;
  showCreator?: boolean;
  memoName?: string;
  showMemoId?: boolean;
}) => {
  const creatorName = creator?.displayName || creator?.username;
  const memoId = showMemoId && memoName ? extractMemoIdFromName(memoName).slice(0, 6) : undefined;

  if (!creatorName && !memoId) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground leading-none shrink-0">
      {showMemoId && memoId && (
        <span className="text-[8px] font-mono px-1 py-0.5 rounded border border-border bg-muted/40 shrink-0">{memoId}</span>
      )}
      {showCreator && creatorName && <span className="font-medium text-foreground/80 truncate">{creatorName}</span>}
    </div>
  );
};

const MemoPreview = ({
  content,
  attachments,
  name,
  compact = true,
  className,
  creator,
  showCreator = false,
  showMemoId = false,
  truncate = false,
}: MemoPreviewProps) => {
  const hasContent = content.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const showMeta = showCreator || showMemoId;

  if (!hasContent && !hasAttachments) {
    return null;
  }

  const meta = <PreviewMeta creator={creator} showCreator={showCreator} memoName={name} showMemoId={showMemoId} />;
  const contentNode = truncate ? (
    hasContent ? (
      <div className="text-sm text-muted-foreground truncate min-w-0">{content}</div>
    ) : hasAttachments ? null : (
      <div className="text-sm text-muted-foreground truncate min-w-0">No content</div>
    )
  ) : (
    hasContent && <MemoContent content={content} compact={compact} />
  );

  return (
    <MemoViewContext.Provider value={STUB_CONTEXT}>
      <div
        className={cn(
          "pointer-events-none",
          truncate ? "flex items-center gap-1.5 min-w-0 leading-tight" : "flex flex-col gap-1",
          className,
        )}
      >
        {showMeta && meta}
        {showMeta && truncate && (hasContent || hasAttachments) && <div className="text-muted-foreground/50 shrink-0">·</div>}
        {contentNode}
        {hasAttachments &&
          (truncate ? (
            <div className="shrink-0 text-muted-foreground/70 inline-flex justify-center items-center gap-0.5">
              <FileIcon className="w-3 h-3 inline-block" />
              <span className="text-xs">{attachments.length}</span>
            </div>
          ) : (
            <AttachmentThumbnails attachments={attachments} />
          ))}
      </div>
    </MemoViewContext.Provider>
  );
};

export default MemoPreview;
