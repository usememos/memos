import { Link, useLocation } from "react-router-dom";
import RelativeTime from "@/components/RelativeTime";
import { Button, buttonVariants } from "@/components/ui/button";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNewMemo } from "@/contexts/NewMemoContext";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { getCreatorHomePath } from "@/router/routes";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getVisibilityOption } from "@/utils/memo";
import MemoActionMenu from "../../MemoActionMenu";
import { ReactionSelector } from "../../MemoReactionListView";
import UserAvatar from "../../UserAvatar";
import VisibilityIcon from "../../VisibilityIcon";
import { MEMO_TIME_CONTROL_CLASSES } from "../constants";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import { createMemoNavigationState, isMemoDetailPath } from "../navigation";
import type { MemoHeaderProps } from "../types";
import MemoSpaceBadge from "./MemoSpaceBadge";

/** The card's trailing actions are the kit's quiet 24px squares, whether or not they are kit buttons. */
const MEMO_HEADER_ACTION_CLASSES = cn(buttonVariants({ variant: "quiet", size: "icon-sm" }));

const MemoHeader: React.FC<MemoHeaderProps> = ({ timeDisplay = "relative", showCreator, showVisibility, showSpace }) => {
  const t = useTranslate();

  const { memo, creator, currentUser, parentPage, isArchived, readonly, openEditor } = useMemoViewContext();
  const location = useLocation();
  const { createTime, updateTime, displayTime: memoDisplayTime, isDisplayingUpdatedTime, relativeTimeFormat } = useMemoViewDerived();
  const { newMemoName } = useNewMemo();
  const visibilityOption = getVisibilityOption(memo.visibility);

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
    // A fixed 24px row, the height of its action squares, so the card's top edge never
    // moves with what the header happens to show.
    <div className="flex h-6 w-full items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* The time stays visible while the creator and Space badge can shrink and truncate. */}
        <div data-slot="memo-header-meta" className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {showCreator && creator && <CreatorDisplay creator={creator} />}
          <TimeDisplay
            displayTime={displayTime}
            timeTooltip={timeTooltip}
            memoName={memo.name}
            parentPage={parentPage}
            isCurrentPage={isMemoDetailPath(location.pathname, memo.name)}
          />
          {spaceMetadata}
        </div>
        {memo.name === newMemoName && (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium leading-none text-primary">
            {t("memo.new-badge")}
          </span>
        )}
      </div>

      <div data-slot="memo-header-actions" className="flex shrink-0 select-none flex-row items-center justify-end gap-1">
        {currentUser && !isArchived && (
          // On desktop the picker's trigger shows only while the card is engaged or the picker is open.
          <span className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex sm:has-[[data-popup-open]]:flex">
            <ReactionSelector memo={memo} trigger={<Button variant="quiet" size="icon-sm" />} />
          </span>
        )}

        {showVisibility && memo.visibility !== Visibility.PRIVATE && (
          <Tooltip>
            <TooltipTrigger aria-label={visibilityOption && t(visibilityOption.labelKey)} className={MEMO_HEADER_ACTION_CLASSES}>
              <VisibilityIcon visibility={memo.visibility} className="text-current" />
            </TooltipTrigger>
            <TooltipContent>{visibilityOption && t(visibilityOption.labelKey)}</TooltipContent>
          </Tooltip>
        )}

        <MemoActionMenu memo={memo} parentPage={parentPage} readonly={readonly} onEdit={openEditor} />
      </div>
    </div>
  );
};

/**
 * The author on one line with the time: a 20px avatar in a 20px slot, then the name in
 * medium 13px foreground ink. It is the identity, so it carries the weight; the time after
 * it is muted.
 */
const CreatorDisplay: React.FC<{ creator: User }> = ({ creator }) => (
  <>
    <Link
      className={cn(
        "flex min-w-0 shrink items-center gap-1.5 rounded-sm text-ui font-medium text-foreground transition-colors hover:text-foreground/80",
        FOCUS_VISIBLE_OUTLINE_CLASSES,
      )}
      to={getCreatorHomePath(creator.username)}
      viewTransition
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <UserAvatar className="size-5 rounded-[5px]" avatarUrl={creator.avatarUrl} name={creator.displayName || creator.username} />
      </span>
      <span className="min-w-0 truncate">{creator.displayName || creator.username}</span>
    </Link>
    <span aria-hidden="true" className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  </>
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
  memoName: string;
  parentPage: string;
  /** On the memo's own page the permalink would lead nowhere, so the time is plain text. */
  isCurrentPage: boolean;
}

/** The timestamp is the memo's permalink: a real link, so it previews its URL and opens in a new tab. */
const TimeDisplay: React.FC<TimeDisplayProps> = ({ displayTime, timeTooltip, memoName, parentPage, isCurrentPage }) => (
  <TimeTooltip content={timeTooltip}>
    {isCurrentPage ? (
      <span className="shrink-0 whitespace-nowrap text-ui text-muted-foreground select-none">{displayTime}</span>
    ) : (
      <Link
        className={cn(MEMO_TIME_CONTROL_CLASSES, "underline-offset-2 hover:underline")}
        to={`/${memoName}`}
        state={createMemoNavigationState(parentPage)}
        viewTransition
      >
        {displayTime}
      </Link>
    )}
  </TimeTooltip>
);

export default MemoHeader;
