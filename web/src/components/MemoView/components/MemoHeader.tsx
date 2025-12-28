import { timestampDate } from "@bufbuild/protobuf/wkt";
import { BookmarkIcon, EyeOffIcon, MessageCircleMoreIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import MemoActionMenu from "../../MemoActionMenu";
import { ReactionSelector } from "../../MemoReactionListView";
import UserAvatar from "../../UserAvatar";
import VisibilityIcon from "../../VisibilityIcon";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import type { MemoHeaderProps } from "../types";

const MemoHeader: React.FC<MemoHeaderProps> = ({
  showCreator,
  showVisibility,
  showPinned,
  onEdit,
  onGotoDetail,
  onUnpin,
  onToggleNsfwVisibility,
  reactionSelectorOpen,
  onReactionSelectorOpenChange,
}) => {
  const t = useTranslate();

  const { memo, creator, parentPage, showNSFWContent, nsfw } = useMemoViewContext();
  const { isArchived, readonly, isInMemoDetailPage, commentAmount, relativeTimeFormat } = useMemoViewDerived();

  const displayTime = isArchived ? (
    (memo.displayTime ? timestampDate(memo.displayTime) : undefined)?.toLocaleString(i18n.language)
  ) : (
    <relative-time
      datetime={(memo.displayTime ? timestampDate(memo.displayTime) : undefined)?.toISOString()}
      lang={i18n.language}
      format={relativeTimeFormat}
    ></relative-time>
  );

  return (
    <div className="w-full flex flex-row justify-between items-center gap-2">
      {/* Left section: Creator info or time */}
      <div className="w-auto max-w-[calc(100%-8rem)] grow flex flex-row justify-start items-center">
        {showCreator && creator ? (
          <CreatorDisplay creator={creator} displayTime={displayTime} onGotoDetail={onGotoDetail} />
        ) : (
          <TimeDisplay displayTime={displayTime} onGotoDetail={onGotoDetail} />
        )}
      </div>

      {/* Right section: Actions */}
      <div className="flex flex-row justify-end items-center select-none shrink-0 gap-2">
        {/* Reaction selector */}
        {!isArchived && (
          <ReactionSelector
            className={cn("border-none w-auto h-auto", reactionSelectorOpen && "block!", "hidden group-hover:block")}
            memo={memo}
            onOpenChange={onReactionSelectorOpenChange}
          />
        )}

        {/* Comment count link */}
        {!isInMemoDetailPage && (
          <Link
            className={cn(
              "flex flex-row justify-start items-center rounded-md p-1 hover:opacity-80",
              commentAmount === 0 && "invisible group-hover:visible",
            )}
            to={`/${memo.name}#comments`}
            viewTransition
            state={{ from: parentPage }}
          >
            <MessageCircleMoreIcon className="w-4 h-4 mx-auto text-muted-foreground" />
            {commentAmount > 0 && <span className="text-xs text-muted-foreground">{commentAmount}</span>}
          </Link>
        )}

        {/* Visibility icon */}
        {showVisibility && memo.visibility !== Visibility.PRIVATE && (
          <Tooltip>
            <TooltipTrigger>
              <span className="flex justify-center items-center rounded-md hover:opacity-80">
                <VisibilityIcon visibility={memo.visibility} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as Parameters<typeof t>[0])}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Pinned indicator */}
        {showPinned && memo.pinned && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer">
                  <BookmarkIcon className="w-4 h-auto text-primary" onClick={onUnpin} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("common.unpin")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* NSFW hide button */}
        {nsfw && showNSFWContent && onToggleNsfwVisibility && (
          <span className="cursor-pointer">
            <EyeOffIcon className="w-4 h-auto text-primary" onClick={onToggleNsfwVisibility} />
          </span>
        )}

        {/* Action menu */}
        <MemoActionMenu memo={memo} readonly={readonly} onEdit={onEdit} />
      </div>
    </div>
  );
};

interface CreatorDisplayProps {
  creator: User;
  displayTime: React.ReactNode;
  onGotoDetail: () => void;
}

const CreatorDisplay: React.FC<CreatorDisplayProps> = ({ creator, displayTime, onGotoDetail }) => (
  <div className="w-full flex flex-row justify-start items-center">
    <Link className="w-auto hover:opacity-80 rounded-md transition-colors" to={`/u/${encodeURIComponent(creator.username)}`} viewTransition>
      <UserAvatar className="mr-2 shrink-0" avatarUrl={creator.avatarUrl} />
    </Link>
    <div className="w-full flex flex-col justify-center items-start">
      <Link
        className="block leading-tight hover:opacity-80 rounded-md transition-colors truncate text-muted-foreground"
        to={`/u/${encodeURIComponent(creator.username)}`}
        viewTransition
      >
        {creator.displayName || creator.username}
      </Link>
      <button
        type="button"
        className="w-auto -mt-0.5 text-xs leading-tight text-muted-foreground select-none cursor-pointer hover:opacity-80 transition-colors text-left"
        onClick={onGotoDetail}
      >
        {displayTime}
      </button>
    </div>
  </div>
);

interface TimeDisplayProps {
  displayTime: React.ReactNode;
  onGotoDetail: () => void;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ displayTime, onGotoDetail }) => (
  <button
    type="button"
    className="w-full text-sm leading-tight text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors text-left"
    onClick={onGotoDetail}
  >
    {displayTime}
  </button>
);

export default MemoHeader;
