import { timestampDate } from "@bufbuild/protobuf/wkt";
import { forwardRef, useMemo } from "react";
import MemoContent from "@/components/MemoContent";
import { separateAttachments } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import UserAvatar from "@/components/UserAvatar";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { buildAttachmentVisualItems, countLogicalAttachmentItems } from "@/utils/media-item";
import { useMemoViewContext } from "../MemoView/MemoViewContext";
import { getMemoSharePreviewAvatarUrl } from "./memoShareImage";

const MemoShareImagePreview = forwardRef<HTMLDivElement, { width: number }>(({ width }, ref) => {
  const t = useTranslate();
  const { memo, creator, blurred, showBlurredContent } = useMemoViewContext();

  const displayName = creator?.displayName || creator?.username || t("common.memo");
  const avatarUrl = getMemoSharePreviewAvatarUrl(creator?.avatarUrl);
  const displayTime = memo.displayTime ? timestampDate(memo.displayTime) : memo.createTime ? timestampDate(memo.createTime) : undefined;
  const formattedDisplayTime = displayTime?.toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const { attachmentCount, nonVisualAttachmentCount, visualItems } = useMemo(() => {
    const attachmentGroups = separateAttachments(memo.attachments);
    const previewVisualItems = buildAttachmentVisualItems(attachmentGroups.visual);
    const totalAttachmentCount = countLogicalAttachmentItems(memo.attachments);

    return {
      attachmentCount: totalAttachmentCount,
      nonVisualAttachmentCount: totalAttachmentCount - previewVisualItems.length,
      visualItems: previewVisualItems,
    };
  }, [memo.attachments]);

  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-border/50 bg-background p-2 sm:p-2.5" style={{ width }}>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-background p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar avatarUrl={avatarUrl} className="h-8 w-8 rounded-xl" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-foreground">{displayName}</div>
              {formattedDisplayTime && <div className="truncate text-xs text-muted-foreground">{formattedDisplayTime}</div>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className={cn("pointer-events-none", blurred && !showBlurredContent && "blur-lg")}>
            <MemoContent content={memo.content} compact={false} contentClassName="text-[14px] leading-6.5 sm:text-[15px]" />
          </div>
        </div>

        {visualItems.length > 0 && (
          <div className={cn("mt-4 grid gap-1.5", visualItems.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {visualItems.slice(0, 4).map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "relative overflow-hidden rounded-md border border-border/70 bg-muted/30",
                  visualItems.length === 1 ? "aspect-[4/3]" : "aspect-square",
                  visualItems.length === 3 && index === 0 && "col-span-2 aspect-[2.2/1]",
                )}
              >
                <img src={item.posterUrl} alt={item.filename} className="h-full w-full object-cover" loading="eager" decoding="async" />
                {index === 3 && visualItems.length > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/35 text-lg font-semibold text-background">
                    +{visualItems.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(memo.tags.length > 0 || nonVisualAttachmentCount > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {memo.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full border border-border/70 bg-muted/55 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
            {memo.tags.length > 3 && (
              <span className="inline-flex rounded-full border border-border/70 bg-muted/55 px-2 py-0.5 text-[11px] text-muted-foreground">
                +{memo.tags.length - 3}
              </span>
            )}
            {nonVisualAttachmentCount > 0 && (
              <span className="inline-flex rounded-full border border-border/70 bg-muted/55 px-2 py-0.5 text-[11px] text-muted-foreground">
                {attachmentCount} {t("common.attachments").toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

MemoShareImagePreview.displayName = "MemoShareImagePreview";

export default MemoShareImagePreview;
