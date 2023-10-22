import { Select, Tooltip, Option, IconButton } from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import FloatingNavButton from "@/components/FloatingNavButton";
import Icon from "@/components/Icon";
import Memo from "@/components/Memo";
import MemoContent from "@/components/MemoContent";
import MemoEditor from "@/components/MemoEditor";
import showMemoEditorDialog from "@/components/MemoEditor/MemoEditorDialog";
import MemoRelationListView from "@/components/MemoRelationListView";
import MemoResourceListView from "@/components/MemoResourceListView";
import showShareMemoDialog from "@/components/ShareMemoDialog";
import UserAvatar from "@/components/UserAvatar";
import VisibilityIcon from "@/components/VisibilityIcon";
import { UNKNOWN_ID, VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { getDateTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useGlobalStore, useMemoStore } from "@/store/module";
import { useUserV1Store } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
  const params = useParams();
  const navigateTo = useNavigateTo();
  const globalStore = useGlobalStore();
  const memoStore = useMemoStore();
  const userV1Store = useUserV1Store();
  const currentUser = useCurrentUser();
  const [creator, setCreator] = useState<User>();
  const { systemStatus } = globalStore.state;
  const memoId = Number(params.memoId);
  const memo = memoStore.state.memos.find((memo) => memo.id === memoId);
  const allowEdit = memo?.creatorUsername === currentUser?.username;
  const referenceRelations = memo?.relationList.filter((relation) => relation.type === "REFERENCE") || [];
  const commentRelations = memo?.relationList.filter((relation) => relation.relatedMemoId === memo.id && relation.type === "COMMENT") || [];
  const comments = commentRelations
    .map((relation) => memoStore.state.memos.find((memo) => memo.id === relation.memoId))
    .filter((memo) => memo) as Memo[];

  // Prepare memo.
  useEffect(() => {
    if (memoId && !isNaN(memoId)) {
      memoStore
        .fetchMemoById(memoId)
        .then(async (memo) => {
          const user = await userV1Store.getOrFetchUserByUsername(memo.creatorUsername);
          setCreator(user);
        })
        .catch((error) => {
          console.error(error);
          toast.error(error.response.data.message);
        });
    } else {
      navigateTo("/404");
    }
  }, [memoId]);

  // Prepare memo comments.
  useEffect(() => {
    if (!memo) {
      return;
    }

    (async () => {
      const commentRelations = memo.relationList.filter((relation) => relation.relatedMemoId === memo.id && relation.type === "COMMENT");
      const requests = commentRelations.map((relation) => memoStore.fetchMemoById(relation.memoId));
      await Promise.all(requests);
    })();
  }, [memo?.relationList]);

  if (!memo) {
    return null;
  }

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    await memoStore.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  const handleEditMemoClick = () => {
    showMemoEditorDialog({
      memoId: memo.id,
    });
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toast.success(t("message.succeed-copy-link"));
  };

  const handleCommentCreated = async () => {
    await memoStore.fetchMemoById(memoId);
  };

  return (
    <>
      <section className="relative top-0 w-full min-h-full overflow-x-hidden bg-zinc-100 dark:bg-zinc-900">
        <div className="relative w-full h-auto mx-auto flex flex-col justify-start items-center bg-white dark:bg-zinc-700">
          <div className="w-full flex flex-col justify-start items-center pt-16 pb-8">
            <UserAvatar className="!w-20 h-auto mb-2 drop-shadow" avatarUrl={systemStatus.customizedProfile.logoUrl} />
            <p className="text-3xl text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
          </div>
          <div className="relative flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4 pb-6">
            {memo.parent && (
              <div className="w-auto mb-4">
                <Link
                  className="px-3 py-1 border rounded-full max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-gray-500 hover:shadow hover:opacity-80"
                  to={`/m/${memo.parent.id}`}
                >
                  <Icon.ArrowUpLeftFromCircle className="w-4 h-auto shrink-0 opacity-60" />
                  <span className="mx-1 opacity-60">#{memo.parent.id}</span>
                  <span className="truncate">{memo.parent.content}</span>
                </Link>
              </div>
            )}
            <div className="w-full mb-4 flex flex-row justify-start items-center mr-1">
              <span className="text-gray-400 select-none">{getDateTimeString(memo.displayTs)}</span>
            </div>
            <MemoContent content={memo.content} />
            <MemoResourceListView resourceList={memo.resourceList} />
            <MemoRelationListView memo={memo} relationList={referenceRelations} />
            <div className="w-full mt-4 flex flex-col sm:flex-row justify-start sm:justify-between sm:items-center gap-2">
              <div className="flex flex-row justify-start items-center">
                <Tooltip title={"Identifier"} placement="top">
                  <span className="text-sm text-gray-500 dark:text-gray-400">#{memo.id}</span>
                </Tooltip>
                <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
                <Link to={`/u/${encodeURIComponent(memo.creatorUsername)}`}>
                  <Tooltip title={"Creator"} placement="top">
                    <span className="flex flex-row justify-start items-center">
                      <UserAvatar className="!w-5 !h-auto mr-1" avatarUrl={creator?.avatarUrl} />
                      <span className="text-sm text-gray-600 max-w-[8em] truncate dark:text-gray-400">{creator?.nickname}</span>
                    </span>
                  </Tooltip>
                </Link>
                {allowEdit && (
                  <>
                    <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
                    <Select
                      className="w-auto text-sm"
                      variant="plain"
                      value={memo.visibility}
                      startDecorator={<VisibilityIcon visibility={memo.visibility} />}
                      onChange={(_, visibility) => {
                        if (visibility) {
                          handleMemoVisibilityOptionChanged(visibility);
                        }
                      }}
                    >
                      {VISIBILITY_SELECTOR_ITEMS.map((item) => (
                        <Option key={item} value={item} className="whitespace-nowrap">
                          {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
                        </Option>
                      ))}
                    </Select>
                  </>
                )}
              </div>
              <div className="flex flex-row sm:justify-end items-center">
                {allowEdit && (
                  <Tooltip title={"Edit"} placement="top">
                    <IconButton size="sm" onClick={handleEditMemoClick}>
                      <Icon.Edit3 className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={"Copy link"} placement="top">
                  <IconButton size="sm" onClick={handleCopyLinkBtnClick}>
                    <Icon.Link className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={"Share"} placement="top">
                  <IconButton size="sm" onClick={() => showShareMemoDialog(memo)}>
                    <Icon.Share className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-8 pb-16 w-full border-t dark:border-t-zinc-700">
          <div className="relative mx-auto flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4 gap-y-1">
            {comments.length === 0 ? (
              <div className="w-full flex flex-col justify-center items-center py-6 mb-2">
                <Icon.MessageCircle strokeWidth={1} className="w-8 h-auto text-gray-400" />
                <p className="text-gray-400 italic text-sm">{t("memo.comment.no-comment")}</p>
              </div>
            ) : (
              <>
                <div className="w-full flex flex-row justify-start items-center pl-3 mb-3">
                  <Icon.MessageCircle className="w-5 h-auto text-gray-400 mr-1" />
                  <span className="text-gray-400 text-sm">{t("memo.comment.self")}</span>
                  <span className="text-gray-400 text-sm ml-0.5">({comments.length})</span>
                </div>
                {comments.map((comment) => (
                  <Memo key={comment.id} memo={comment} />
                ))}
              </>
            )}

            {/* Only show comment editor when user login */}
            {currentUser && (
              <MemoEditor
                key={memo.id}
                className="!border"
                cacheKey={`comment-editor-${memo.id}`}
                relationList={[{ memoId: UNKNOWN_ID, relatedMemoId: memo.id, type: "COMMENT" }]}
                onConfirm={handleCommentCreated}
              />
            )}
          </div>
        </div>
      </section>

      <FloatingNavButton />
    </>
  );
};

export default MemoDetail;
