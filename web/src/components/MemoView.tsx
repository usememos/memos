import { Tooltip } from "@mui/joy";
import classNames from "classnames";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getRelativeTimeString, getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUserStore, extractUsernameFromName } from "@/store/v1";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo, Visibility } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import showChangeMemoCreatedTsDialog from "./ChangeMemoCreatedTsDialog";
import Icon from "./Icon";
import MemoActionMenu from "./MemoActionMenu";
import MemoContent from "./MemoContent";
import MemoReactionistView from "./MemoReactionListView";
import MemoRelationListView from "./MemoRelationListView";
import MemoResourceListView from "./MemoResourceListView";
import showPreviewImageDialog from "./PreviewImageDialog";
import ReactionSelector from "./ReactionSelector";
import UserAvatar from "./UserAvatar";
import VisibilityIcon from "./VisibilityIcon";

interface Props {
  memo: Memo;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  className?: string;
}

const MemoView: React.FC<Props> = (props: Props) => {
  const { memo, className } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { i18n } = useTranslation();
  const currentUser = useCurrentUser();
  const userStore = useUserStore();
  const user = useCurrentUser();
  const [displayTime, setDisplayTime] = useState<string>(getRelativeTimeString(getTimeStampByDate(memo.displayTime)));
  const [creator, setCreator] = useState(userStore.getUserByUsername(extractUsernameFromName(memo.creator)));
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const referenceRelations = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const readonly = memo.creator !== user?.name;

  useEffect(() => {
    (async () => {
      const user = await userStore.getOrFetchUserByUsername(extractUsernameFromName(memo.creator));
      setCreator(user);
    })();
  }, []);

  // Update display time string.
  useEffect(() => {
    let intervalFlag: any = -1;
    if (Date.now() - getTimeStampByDate(memo.displayTime) < 1000 * 60 * 60 * 24) {
      intervalFlag = setInterval(() => {
        setDisplayTime(getRelativeTimeString(getTimeStampByDate(memo.displayTime)));
      }, 1000 * 1);
    }

    return () => {
      clearInterval(intervalFlag);
    };
  }, [i18n.language]);

  const handleGotoMemoDetailPage = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.altKey) {
      showChangeMemoCreatedTsDialog(memo.id);
    } else {
      navigateTo(`/m/${memo.name}`);
    }
  };

  const handleMemoContentClick = useCallback(async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        showPreviewImageDialog([imgUrl], 0);
      }
    }
  }, []);

  return (
    <div
      className={classNames(
        "group relative flex flex-col justify-start items-start w-full px-4 pt-2 pb-3 mb-2 bg-white dark:bg-zinc-800 rounded-lg border border-white dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700",
        "memos-" + memo.id,
        memo.pinned && props.showPinned && "border-gray-200 border dark:border-zinc-700",
        className,
      )}
      ref={memoContainerRef}
    >
      <div className="w-full h-7 flex flex-row justify-between items-center mb-1">
        <div className="w-auto flex flex-row justify-start items-center mr-1">
          {props.showCreator && creator && (
            <>
              <Link to={`/u/${encodeURIComponent(extractUsernameFromName(memo.creator))}`} unstable_viewTransition>
                <Tooltip title={"Creator"} placement="top">
                  <span className="flex flex-row justify-start items-center">
                    <UserAvatar className="!w-5 !h-5 mr-1" avatarUrl={creator.avatarUrl} />
                    <span className="text-sm text-gray-600 max-w-[8em] truncate dark:text-gray-400">
                      {creator.nickname || creator.username}
                    </span>
                  </span>
                </Tooltip>
              </Link>
              <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
            </>
          )}
          <span className="text-sm text-gray-400 select-none" onClick={handleGotoMemoDetailPage}>
            {displayTime}
          </span>
          {props.showPinned && memo.pinned && (
            <>
              <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
              <Tooltip title={"Pinned"} placement="top">
                <Icon.Bookmark className="w-4 h-auto text-amber-500" />
              </Tooltip>
            </>
          )}
        </div>
        <div className="flex flex-row justify-end items-center select-none">
          <div className="w-auto invisible group-hover:visible flex flex-row justify-between items-center">
            {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
              <Tooltip title={t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as any)} placement="top">
                <span className="h-7 w-7 flex justify-center items-center hover:opacity-70">
                  <VisibilityIcon visibility={memo.visibility} />
                </span>
              </Tooltip>
            )}
            {currentUser && <ReactionSelector className="border-none" memo={memo} />}
          </div>
          {!readonly && <MemoActionMenu memo={memo} hiddenActions={props.showPinned ? [] : ["pin"]} />}
        </div>
      </div>
      <MemoContent
        key={`${memo.id}-${memo.updateTime}`}
        memoId={memo.id}
        content={memo.content}
        readonly={readonly}
        onClick={handleMemoContentClick}
      />
      <MemoResourceListView resources={memo.resources} />
      <MemoRelationListView memo={memo} relations={referenceRelations} />
      <MemoReactionistView memo={memo} reactions={memo.reactions} />
    </div>
  );
};

export default memo(MemoView);
