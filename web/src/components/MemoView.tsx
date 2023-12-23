import { Divider, Tooltip } from "@mui/joy";
import { memo, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UNKNOWN_ID } from "@/helpers/consts";
import { getRelativeTimeString, getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useFilterStore } from "@/store/module";
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
  showParent?: boolean;
  showVisibility?: boolean;
  showPinnedStyle?: boolean;
}

const MemoView: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { i18n } = useTranslation();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const user = useCurrentUser();
  const [displayTime, setDisplayTime] = useState<string>(getRelativeTimeString(getTimeStampByDate(memo.displayTime)));
  const [creator, setCreator] = useState(userStore.getUserByUsername(extractUsernameFromName(memo.creator)));
  const [parentMemo, setParentMemo] = useState<Memo | undefined>(undefined);
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const referenceRelations = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const readonly = memo.creator !== user?.name;

  useEffect(() => {
    (async () => {
      const user = await userStore.getOrFetchUserByUsername(extractUsernameFromName(memo.creator));
      setCreator(user);
    })();

    const parentMemoId = memo.relations.find(
      (relation) => relation.memoId === memo.id && relation.type === MemoRelation_Type.COMMENT
    )?.relatedMemoId;
    if (parentMemoId) {
      memoStore.getOrFetchMemoById(parentMemoId, { skipStore: true }).then((memo: Memo) => {
        setParentMemo(memo);
      });
    }
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

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.classList.contains("tag-container")) {
      const tagName = targetEl.innerText.slice(1);
      const currTagQuery = filterStore.getState().tag;
      if (currTagQuery === tagName) {
        filterStore.setTagFilter(undefined);
      } else {
        filterStore.setTagFilter(tagName);
      }
    } else if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        showPreviewImageDialog([imgUrl], 0);
      }
    }
  };

  return (
    <div
      className={`group memo-wrapper ${"memos-" + memo.id} ${memo.pinned && props.showPinnedStyle ? "pinned" : ""}`}
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
          {props.showPinnedStyle && memo.pinned && (
            <>
              <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
              <Tooltip title={"Pinned"} placement="top">
                <Icon.Bookmark className="w-4 h-auto text-green-600" />
              </Tooltip>
            </>
          )}
          <div className="w-auto hidden group-hover:flex flex-row justify-between items-center">
            <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
            <Link className="flex flex-row justify-start items-center" to={`/m/${memo.id}`} unstable_viewTransition>
              <Tooltip title={"Identifier"} placement="top">
                <span className="text-sm text-gray-500 dark:text-gray-400">#{memo.id}</span>
              </Tooltip>
            </Link>
            {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
              <>
                <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
                <Tooltip title={t(`memo.visibility.${convertVisibilityToString(memo.visibility)}` as any)} placement="top">
                  <span>
                    <VisibilityIcon visibility={memo.visibility} />
                  </span>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        <div className="btns-container space-x-2">
          {!readonly && (
            <>
              <span className="btn more-action-btn">
                <Icon.MoreVertical className="icon-img" />
              </span>
              <div className="more-action-btns-wrapper">
                <div className="more-action-btns-container min-w-[6em]">
                  {!parentMemo && (
                    <span className="btn" onClick={handleTogglePinMemoBtnClick}>
                      {memo.pinned ? <Icon.BookmarkMinus className="w-4 h-auto mr-2" /> : <Icon.BookmarkPlus className="w-4 h-auto mr-2" />}
                      {memo.pinned ? t("common.unpin") : t("common.pin")}
                    </span>
                  )}
                  <span className="btn" onClick={handleEditMemoClick}>
                    <Icon.Edit3 className="w-4 h-auto mr-2" />
                    {t("common.edit")}
                  </span>
                  {!parentMemo && (
                    <span className="btn" onClick={handleMarkMemoClick}>
                      <Icon.Link className="w-4 h-auto mr-2" />
                      {t("common.mark")}
                    </span>
                  )}
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
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {props.showParent && parentMemo && (
        <div className="w-auto max-w-full mb-1">
          <Link
            className="px-2 py-0.5 border rounded-full max-w-xs w-auto text-xs flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-gray-500 hover:shadow hover:opacity-80"
            to={`/m/${parentMemo.id}`}
            unstable_viewTransition
          >
            <Icon.ArrowUpRightFromCircle className="w-3 h-auto shrink-0 opacity-60" />
            <span className="mx-1 opacity-60">#{parentMemo.id}</span>
            <span className="truncate">{parentMemo.content}</span>
          </Link>
        </div>
      )}
      <MemoContent content={memo.content} nodes={memo.nodes} onMemoContentClick={handleMemoContentClick} />
      <MemoResourceListView resourceList={memo.resources} />
      <MemoRelationListView memo={memo} relationList={referenceRelations} />
    </div>
  );
};

export default memo(MemoView);
