import { cn } from "@/lib/utils";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";
import { AttachmentList, LocationDisplay, RelationList } from "./metadata";

const NsfwOverlay: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 z-10 pt-4 flex items-center justify-center" onClick={onClick}>
      <button
        type="button"
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
      >
        {t("memo.click-to-show-nsfw-content")}
      </button>
    </div>
  );
};

const MemoBody: React.FC<MemoBodyProps> = ({ compact, onContentClick, onContentDoubleClick, onToggleNsfwVisibility }) => {
  const { memo, parentPage, showNSFWContent, nsfw } = useMemoViewContext();

  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-2",
          nsfw && !showNSFWContent && "blur-lg transition-all duration-200",
        )}
      >
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          content={memo.content}
          onClick={onContentClick}
          onDoubleClick={onContentDoubleClick}
          compact={memo.pinned ? false : compact} // Always show full content when pinned
        />
        <AttachmentList attachments={memo.attachments} />
        <RelationList relations={referencedMemos} currentMemoName={memo.name} parentPage={parentPage} />
        {memo.location && <LocationDisplay location={memo.location} />}
        <MemoReactionListView memo={memo} reactions={memo.reactions} />
      </div>

      {nsfw && !showNSFWContent && <NsfwOverlay onClick={onToggleNsfwVisibility} />}
    </>
  );
};

export default MemoBody;
