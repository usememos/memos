import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { AlertCircleIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import MemoContent from "@/components/MemoContent";
import { AttachmentListView } from "@/components/MemoMetadata";
import { useImagePreview } from "@/components/MemoView/hooks";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import UserAvatar from "@/components/UserAvatar";
import { useSharedMemo } from "@/hooks/useMemoShareQueries";
import { useUser } from "@/hooks/useUserQueries";
import i18n from "@/i18n";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";

function withShareAttachmentLinks(attachments: Attachment[], token: string): Attachment[] {
  return attachments.map((a) => {
    if (a.externalLink) return a;
    return { ...a, externalLink: `${window.location.origin}/file/${a.name}/${a.filename}?share_token=${encodeURIComponent(token)}` };
  });
}

const SharedMemo = () => {
  const t = useTranslate();
  const { token = "" } = useParams<{ token: string }>();
  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const { data: memo, error, isLoading } = useSharedMemo(token, { enabled: !!token });
  const { data: creator } = useUser(memo?.creator ?? "", { enabled: !!memo?.creator });

  const isNotFound = error instanceof ConnectError && (error.code === Code.NotFound || error.code === Code.Unauthenticated);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isNotFound || (!isLoading && !memo)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <AlertCircleIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("memo.share.invalid-link")}</p>
      </div>
    );
  }

  if (error || !memo) return null;

  const displayDate = (memo.displayTime as Timestamp | undefined)
    ? timestampDate(memo.displayTime as Timestamp)?.toLocaleString(i18n.language)
    : null;

  return (
    <div className="mx-auto w-full min-w-80 max-w-2xl px-4 py-8">
      {/* Creator + date above the card */}
      <div className="mb-3 flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <UserAvatar className="shrink-0" avatarUrl={creator?.avatarUrl} />
          <span className="text-sm text-muted-foreground">{creator?.displayName || creator?.username || memo.creator}</span>
        </div>
        {displayDate && <span className="text-xs text-muted-foreground">{displayDate}</span>}
      </div>

      <div className="relative flex flex-col items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground">
        <MemoContent content={memo.content} />
        {memo.attachments.length > 0 && (
          <AttachmentListView attachments={withShareAttachmentLinks(memo.attachments, token)} onImagePreview={openPreview} />
        )}
      </div>

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={setPreviewOpen}
        imgUrls={previewState.urls}
        initialIndex={previewState.index}
      />
    </div>
  );
};

export default SharedMemo;
