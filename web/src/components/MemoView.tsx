import { Divider, Tooltip } from "@mui/joy";
import classNames from "classnames";
import copy from "copy-to-clipboard";
import { memo, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UNKNOWN_ID } from "@/helpers/consts";
import { getRelativeTimeString, getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUserStore, extractUsernameFromName, useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v2/common";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo, Visibility } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import showChangeMemoCreatedTsDialog from "./ChangeMemoCreatedTsDialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import Icon from "./Icon";
import MemoContent from "./MemoContent";
import showMemoEditorDialog from "./MemoEditor/MemoEditorDialog";
import MemoRelationListView from "./MemoRelationListView";
import MemoResourceListView from "./MemoResourceListView";
import showPreviewImageDialog from "./PreviewImageDialog";
import showShareMemoDialog from "./ShareMemoDialog";
import UserAvatar from "./UserAvatar";
import VisibilityIcon from "./VisibilityIcon";
import "@/less/memo.less";

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
  const memoStore = useMemoStore();
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
      navigateTo(`/m/${memo.id}`);
    }
  };

  const handleTogglePinMemoBtnClick = async () => {
    try {
      if (memo.pinned) {
        await memoStore.updateMemo(
          {
            id: memo.id,
            pinned: false,
          },
          ["pinned"]
        );
      } else {
        await memoStore.updateMemo(
          {
            id: memo.id,
            pinned: true,
          },
          ["pinned"]
        );
      }
    } catch (error) {
      // do nth
    }
  };

  const handleEditMemoClick = () => {
    showMemoEditorDialog({
      memoId: memo.id,
    });
  };

  const handleMarkMemoClick = () => {
    showMemoEditorDialog({
      relationList: [
        {
          memoId: UNKNOWN_ID,
          relatedMemoId: memo.id,
          type: MemoRelation_Type.REFERENCE,
        },
      ],
    });
  };

  const handleArchiveMemoClick = async () => {
    try {
      await memoStore.updateMemo(
        {
          id: memo.id,
          rowStatus: RowStatus.ARCHIVED,
        },
        ["row_status"]
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const handleDeleteMemoClick = async () => {
    showCommonDialog({
      title: t("memo.delete-memo"),
      content: t("memo.delete-confirm"),
      style: "danger",
      dialogName: "delete-memo-dialog",
      onConfirm: async () => {
        await memoStore.deleteMemo(memo.id);
      },
    });
  };

  const handleCopyMemoId = () => {
    copy(String(memo.id));
    toast.success("Copied to clipboard!");
  };

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        showPreviewImageDialog([imgUrl], 0);
      }
    }
  };

  return (
    <div
      className={classNames("group memo-wrapper", "memos-" + memo.id, memo.pinned && props.showPinned ? "pinned" : "", className)}
      ref={memoContainerRef}
    >
      <div className="memo-top-wrapper mb-1">
        <div className="w-full max-w-[calc(100%-20px)] flex flex-row justify-start items-center mr-1">
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
        <div className="btns-container space-x-2">
          <div className="w-auto hidden group-hover:flex flex-row justify-between items-center">
            {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
              <>
                <Tooltip title={t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as any)} placement="top">
                  <span>
                    <VisibilityIcon visibility={memo.visibility} />
                  </span>
                </Tooltip>
              </>
            )}
          </div>
          {!readonly && (
            <>
              <span className="btn more-action-btn">
                <Icon.MoreVertical className="icon-img" />
              </span>
              <div className="more-action-btns-wrapper">
                <div className="more-action-btns-container min-w-[6em]">
                  {props.showPinned && (
                    <span className="btn" onClick={handleTogglePinMemoBtnClick}>
                      {memo.pinned ? <Icon.BookmarkMinus className="w-4 h-auto mr-2" /> : <Icon.BookmarkPlus className="w-4 h-auto mr-2" />}
                      {memo.pinned ? t("common.unpin") : t("common.pin")}
                    </span>
                  )}
                  <span className="btn" onClick={handleEditMemoClick}>
                    <Icon.Edit3 className="w-4 h-auto mr-2" />
                    {t("common.edit")}
                  </span>
                  <span className="btn" onClick={handleMarkMemoClick}>
                    <Icon.Link className="w-4 h-auto mr-2" />
                    {t("common.mark")}
                  </span>
                  <span className="btn" onClick={() => showShareMemoDialog(memo)}>
                    <Icon.Share className="w-4 h-auto mr-2" />
                    {t("common.share")}
                  </span>
                  <Divider className="!my-1" />
                  <span className="btn text-orange-500" onClick={handleArchiveMemoClick}>
                    <Icon.Archive className="w-4 h-auto mr-2" />
                    {t("common.archive")}
                  </span>
                  <span className="btn text-red-600" onClick={handleDeleteMemoClick}>
                    <Icon.Trash className="w-4 h-auto mr-2" />
                    {t("common.delete")}
                  </span>
                  <Divider className="!my-1" />
                  <div className="w-full px-3 text-xs text-gray-400">
                    <span className="cursor-pointer" onClick={handleCopyMemoId}>
                      ID: <span className="font-mono">{memo.id}</span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <MemoContent memoId={memo.id} nodes={memo.nodes} readonly={readonly} onClick={handleMemoContentClick} />
      <MemoResourceListView resourceList={memo.resources} />
      <MemoRelationListView memo={memo} relationList={referenceRelations} />
    </div>
  );
};

export default memo(MemoView);
