import { BookmarkIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import RelativeTime from "@/components/RelativeTime";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNewMemo } from "@/contexts/NewMemoContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getVisibilityOption } from "@/utils/memo";
import MemoActionMenu from "../../MemoActionMenu";
import { ReactionSelector } from "../../MemoReactionListView";
import UserAvatar from "../../UserAvatar";
import VisibilityIcon from "../../VisibilityIcon";
import { useMemoActions } from "../hooks";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import { createMemoNavigationState } from "../navigation";
import type { MemoHeaderProps } from "../types";
import MemoSpaceBadge from "./MemoSpaceBadge";

/** The card's trailing actions are the kit's quiet 24px squares, whether or not they are kit buttons. */
const MEMO_HEADER_ACTION_CLASSES = cn(buttonVariants({ variant: "quiet", size: "icon-sm" }));

const MemoHeader: React.FC<MemoHeaderProps> = ({ timeDisplay = "relative", showCreator, showVisibility, showPinned, showSpace }) => {
  const t = useTranslate();
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);

  const { memo, creator, currentUser, parentPage, isArchived, readonly, openEditor } = useMemoViewContext();
  const { createTime, updateTime, displayTime: memoDisplayTime, isDisplayingUpdatedTime, relativeTimeFormat } = useMemoViewDerived();
  const { newMemoName } = useNewMemo();
  const visibilityOption = getVisibilityOption(memo.visibility);

  const navigateTo = useNavigateTo();
  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memo.name}`, { state: createMemoNavigationState(parentPage) });
  }, [memo.name, parentPage, navigateTo]);

  const { unpinMemo } = useMemoActions(memo);

  const timeValue = isArchived ? (
    memoDisplayTime?.toLocaleString(i18n.language)
  ) : timeDisplay === "time" ? (
    memoDisplayTime?.toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })
  ) : (
    <RelativeTime date={memoDisplayTime} format={relativeTimeFormat} />
  );
  const displayTime = isDisplayingUpdatedTime ? (
    <>
      {t("common.last-updated-at")} {timeValue}
    </>
  ) : (
    timeValue
  );
  const timeTooltip = {
    createdAt: createTime ? `${t("common.created-at")}: ${createTime.toLocaleString(i18n.language)}` : undefined,
    updatedAt:
      updateTime && (!createTime || updateTime.getTime() !== createTime.getTime())
        ? `${t("common.last-updated-at")}: ${updateTime.toLocaleString(i18n.language)}`
        : undefined,
  };
  const spaceMetadata = showSpace && memo.space ? <MemoSpaceBadge spaceName={memo.space} /> : null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showCreator && creator ? (
          <CreatorDisplay
            creator={creator}
            displayTime={displayTime}
            timeTooltip={timeTooltip}
            trailingMetadata={spaceMetadata}
            onGotoDetail={handleGotoMemoDetailPage}
          />
        ) : (
          <div data-slot="memo-header-meta" className="flex min-w-0 items-center gap-1.5">
            <TimeDisplay displayTime={displayTime} timeTooltip={timeTooltip} onGotoDetail={handleGotoMemoDetailPage} />
            {spaceMetadata}
          </div>
        )}
        {memo.name === newMemoName && (
          <span className="ml-2 shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium leading-none text-primary">
            {t("memo.new-badge")}
          </span>
        )}
      </div>

      <div data-slot="memo-header-actions" className="flex shrink-0 select-none flex-row items-center justify-end gap-1">
        {currentUser && !isArchived && (
          <ReactionSelector
            className={cn(
              MEMO_HEADER_ACTION_CLASSES,
              // The chip's own round bordered look gives way to the header's quiet square.
              "border-none hover:opacity-100",
              reactionSelectorOpen && "sm:flex!",
              "flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex",
            )}
            memo={memo}
            onOpenChange={setReactionSelectorOpen}
          />
        )}

        {showVisibility && memo.visibility !== Visibility.PRIVATE && (
          <Tooltip>
            <TooltipTrigger aria-label={visibilityOption && t(visibilityOption.labelKey)} className={MEMO_HEADER_ACTION_CLASSES}>
              <VisibilityIcon visibility={memo.visibility} className="text-current" />
            </TooltipTrigger>
            <TooltipContent>{visibilityOption && t(visibilityOption.labelKey)}</TooltipContent>
          </Tooltip>
        )}

        {showPinned && memo.pinned && (
          <TooltipProvider>
            <Tooltip>
              {/* The pinned mark keeps its primary ink; that custom look lives on the raw trigger, not a kit button. */}
              <TooltipTrigger
                aria-label={t("common.unpin")}
                className={cn(MEMO_HEADER_ACTION_CLASSES, "text-primary hover:text-primary")}
                onClick={unpinMemo}
              >
                <BookmarkIcon className="size-4" strokeWidth={1.8} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("common.unpin")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <MemoActionMenu memo={memo} parentPage={parentPage} readonly={readonly} onEdit={openEditor} />
      </div>
    </div>
  );
};

interface CreatorDisplayProps {
  creator: User;
  displayTime: React.ReactNode;
  timeTooltip: TimeTooltipContent;
  trailingMetadata?: React.ReactNode;
  onGotoDetail: () => void;
}

const CreatorDisplay: React.FC<CreatorDisplayProps> = ({ creator, displayTime, timeTooltip, trailingMetadata, onGotoDetail }) => (
  <div className="flex min-w-0 items-center">
    <Link className="w-auto hover:opacity-80 rounded-md transition-colors" to={`/u/${encodeURIComponent(creator.username)}`} viewTransition>
      <UserAvatar className="mr-2 shrink-0" avatarUrl={creator.avatarUrl} />
    </Link>
    <div className="flex min-w-0 flex-col items-start justify-center">
      <Link
        className="block leading-tight hover:opacity-80 rounded-md transition-colors truncate text-muted-foreground"
        to={`/u/${encodeURIComponent(creator.username)}`}
        viewTransition
      >
        {creator.displayName || creator.username}
      </Link>
      <div data-slot="memo-header-meta" className="flex min-w-0 items-center gap-1.5">
        <TimeTooltip content={timeTooltip}>
          <button
            type="button"
            className="w-auto -mt-0.5 border-0 bg-transparent p-0 text-xs leading-tight text-muted-foreground select-none cursor-pointer hover:opacity-80 transition-colors text-left"
            onClick={onGotoDetail}
          >
            {displayTime}
          </button>
        </TimeTooltip>
        {trailingMetadata}
      </div>
    </div>
  </div>
);

interface TimeTooltipContent {
  createdAt?: string;
  updatedAt?: string;
}

const TimeTooltip = ({ children, content }: { children: React.ReactElement; content: TimeTooltipContent }) => (
  <Tooltip>
    <TooltipTrigger render={children} />
    <TooltipContent align="start" className="flex flex-col items-start gap-0.5 whitespace-nowrap text-left">
      {content.createdAt && <span>{content.createdAt}</span>}
      {content.updatedAt && <span>{content.updatedAt}</span>}
    </TooltipContent>
  </Tooltip>
);

interface TimeDisplayProps {
  displayTime: React.ReactNode;
  timeTooltip: TimeTooltipContent;
  onGotoDetail: () => void;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ displayTime, timeTooltip, onGotoDetail }) => (
  <TimeTooltip content={timeTooltip}>
    <button
      type="button"
      className="w-auto border-0 bg-transparent p-0 text-sm leading-tight text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors text-left"
      onClick={onGotoDetail}
    >
      {displayTime}
    </button>
  </TimeTooltip>
);

export default MemoHeader;
