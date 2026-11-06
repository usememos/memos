import { Badge, Button, buttonClasses, Popover, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import RelativeTime from "@/components/RelativeTime";
import { useNewMemo } from "@/contexts/NewMemoContext";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { getCreatorHomePath } from "@/router/routes";
import { Visibility } from "@/types/proto/api/memo_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
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

/** The card's trailing actions are the package's 24px ghost squares (`sm`), whether or not they are package buttons. */
const MEMO_HEADER_ACTION_CLASSES = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });

const MemoHeader: React.FC<MemoHeaderProps> = ({ timeDisplay = "relative", showCreator, showVisibility, showSpace }) => {
  const t = useTranslate();

  const { memo, creator, currentUser, parentPage, isArchived, readonly, isEditing, openEditor } = useMemoViewContext();
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
  const showsCreator = Boolean(showCreator && creator);
  const isNew = memo.name === newMemoName;

  // While the card edits in place, the session's timestamp row is the header: the body
  // hands it the identity (`CreatorDisplay`) to lead with, and the time, visibility and
  // Space show once, in their editable form. Reacting or opening the action menu makes no
  // sense mid-edit, and the "new" mark is for finding the memo in the list, not for the
  // person editing it.
  if (isEditing) return null;

  return (
    // A fixed 24px row, the height of its action squares, so the card's top edge never
    // moves with what the header happens to show.
    <div className="flex h-6 w-full items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* The time stays visible while the creator and Space badge can shrink and truncate. */}
        <div data-slot="memo-header-meta" className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {showsCreator && creator && <CreatorDisplay creator={creator} />}
          <TimeDisplay
            displayTime={displayTime}
            timeTooltip={timeTooltip}
            memoName={memo.name}
            parentPage={parentPage}
            isCurrentPage={isMemoDetailPath(location.pathname, memo.name)}
          />
          {spaceMetadata}
        </div>
        {isNew && <NewBadge />}
      </div>

      <div
        data-slot="memo-header-actions"
        // The same 4px gaps on touch screens, so the actions read as one group. Each square's hit
        // area keeps its 44px height but narrows to the 28px pitch, so neighbors meet halfway
        // instead of a later square's area covering the edge of the one before it. The selector only
        // resizes the package's touch-screen pseudo-element; Tailwind's `after:` would also create
        // one on desktop, where it sits beside the icon and pushes it off center.
        className="flex shrink-0 select-none flex-row items-center justify-end gap-1 [&_.mu-hit::after]:w-7"
      >
        {currentUser && !isArchived && (
          // On desktop the picker's trigger shows only while the card is engaged or the picker is open.
          <span className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex sm:has-[[data-popup-open]]:flex">
            <ReactionSelector memo={memo} trigger={<Button variant="ghost" size="sm" icon={<SmilePlusIcon />} />} />
          </span>
        )}

        {showVisibility && memo.visibility !== Visibility.PRIVATE && (
          // The audience is information, not an action: a hover card that a click or tap also opens.
          <Popover.Root>
            <Popover.Trigger
              openOnHover
              delay={300}
              aria-label={visibilityOption && t(visibilityOption.labelKey)}
              className={MEMO_HEADER_ACTION_CLASSES}
            >
              <VisibilityIcon visibility={memo.visibility} className="text-current" />
            </Popover.Trigger>
            {visibilityOption && (
              <Popover.Popup align="end" variant="list" className="w-(--mu-menu-width)">
                <Popover.Title>{t(visibilityOption.labelKey)}</Popover.Title>
                <Popover.Description>{t(visibilityOption.descriptionKey)}</Popover.Description>
              </Popover.Popup>
            )}
          </Popover.Root>
        )}

        <MemoActionMenu memo={memo} parentPage={parentPage} readonly={readonly} onEdit={openEditor} />
      </div>
    </div>
  );
};

const NewBadge = () => {
  const t = useTranslate();
  return (
    <Badge tone="primary" className="shrink-0">
      {t("memo.new-badge")}
    </Badge>
  );
};

/**
 * The author on one line with the time: a 20px avatar in a 20px slot, then the name in
 * medium 13px foreground ink. It is the identity, so it carries the weight; the time after
 * it is muted, after a separator. The editing session leads its timestamp row with it, so
 * the card's header reads the same mid-edit.
 */
export const CreatorDisplay: React.FC<{ creator: User }> = ({ creator }) => (
  <>
    <Link
      className={cn(
        "flex min-w-0 shrink items-center gap-1.5 rounded-mu-sm mu-label-sm text-mu-ink transition-colors hover:text-mu-ink/80",
        "mu-focus",
      )}
      to={getCreatorHomePath(creator.username)}
      viewTransition
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <UserAvatar className="size-5" avatarUrl={creator.avatarUrl} name={creator.displayName || creator.username} />
      </span>
      <span className="min-w-0 truncate">{creator.displayName || creator.username}</span>
    </Link>
    <span aria-hidden="true" className="shrink-0 text-mu-ink-muted/40">
      ·
    </span>
  </>
);

interface TimeTooltipContent {
  createdAt?: string;
  updatedAt?: string;
}

const TimeTooltip = ({ children, content }: { children: React.ReactElement; content: TimeTooltipContent }) => (
  <Tooltip.Root>
    <Tooltip.Trigger render={children} />
    <Tooltip.Popup align="start" className="flex flex-col items-start gap-0.5 whitespace-nowrap text-left">
      {content.createdAt && <span>{content.createdAt}</span>}
      {content.updatedAt && <span>{content.updatedAt}</span>}
    </Tooltip.Popup>
  </Tooltip.Root>
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
      <span className="shrink-0 whitespace-nowrap mu-caption text-mu-ink-muted select-none">{displayTime}</span>
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
