import { cn } from "@/lib/utils";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";
import { AttachmentList, LocationDisplay, RelationList } from "./metadata";

const MemoBody: React.FC<MemoBodyProps> = ({ compact, onContentClick, onContentDoubleClick, onToggleNsfwVisibility }) => {
  const t = useTranslate();

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

      {/* NSFW content overlay */}
      {nsfw && !showNSFWContent && (
        <>
          <div className="absolute inset-0 bg-transparent" />
          <button
            type="button"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent border border-border rounded-lg bg-card transition-colors"
            onClick={onToggleNsfwVisibility}
          >
            {t("memo.click-to-show-nsfw-content")}
          </button>
        </>
      )}
    </>
  );
};

export default MemoBody;
