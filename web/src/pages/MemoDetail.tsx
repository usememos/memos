import { Select, Tooltip, Option, IconButton } from "@mui/joy";
import copy from "copy-to-clipboard";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import MemoEditor from "@/components/MemoEditor";
import showMemoEditorDialog from "@/components/MemoEditor/MemoEditorDialog";
import MemoRelationListView from "@/components/MemoRelationListView";
import MemoResourceListView from "@/components/MemoResourceListView";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import showShareMemoDialog from "@/components/ShareMemoDialog";
import UserAvatar from "@/components/UserAvatar";
import VisibilityIcon from "@/components/VisibilityIcon";
import { getDateTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUserStore, useMemoStore, extractUsernameFromName } from "@/store/v1";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo, Visibility } from "@/types/proto/api/v2/memo_service";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";

const MemoDetail = () => {
  const t = useTranslate();
  const params = useParams();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const [creator, setCreator] = useState<User>();
  const memoName = params.memoName;
  const memo = memoStore.getMemoByName(memoName || "");
  const [parentMemo, setParentMemo] = useState<Memo | undefined>(undefined);
  const referenceRelations = memo?.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE) || [];
  const commentRelations =
    memo?.relations.filter((relation) => relation.relatedMemoId === memo?.id && relation.type === MemoRelation_Type.COMMENT) || [];
  const comments = commentRelations.map((relation) => memoStore.getMemoById(relation.memoId)).filter((memo) => memo) as any as Memo[];
  const readonly = memo?.creatorId !== currentUser?.id;

  // Prepare memo.
  useEffect(() => {
    if (memoName) {
      memoStore
        .getOrFetchMemoByName(memoName)
        .then(async (memo) => {
          const user = await userStore.getOrFetchUserByUsername(extractUsernameFromName(memo.creator));
          setCreator(user);
        })
        .catch((error: ClientError) => {
          toast.error(error.details);
          navigateTo("/403");
        });
    } else {
      navigateTo("/404");
    }
  }, [memoName]);

  // Prepare memo comments.
  useEffect(() => {
    if (!memo) {
      return;
    }

    (async () => {
      if (memo.parentId) {
        memoStore.getOrFetchMemoById(memo.parentId).then((memo: Memo) => {
          setParentMemo(memo);
        });
      } else {
        setParentMemo(undefined);
      }
      await Promise.all(commentRelations.map((relation) => memoStore.getOrFetchMemoById(relation.memoId)));
    })();
  }, [memo]);

  if (!memo) {
    return null;
  }

  const handleMemoVisibilityOptionChanged = async (visibility: Visibility) => {
    await memoStore.updateMemo(
      {
        id: memo.id,
        visibility: visibility,
      },
      ["visibility"],
    );
  };

  const handleEditMemoClick = () => {
    showMemoEditorDialog({
      memoId: memo.id,
      cacheKey: `${memo.id}-${memo.updateTime}`,
    });
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.name}`);
    if (memo.visibility !== Visibility.PUBLIC) {
      toast.success(t("message.succeed-copy-link-not-public"));
    } else {
      toast.success(t("message.succeed-copy-link"));
    }
  };

  const handleCommentCreated = async (commentId: number) => {
    await memoStore.getOrFetchMemoById(commentId);
    await memoStore.getOrFetchMemoById(memo.id, { skipCache: true });
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="relative flex-grow w-full min-h-full flex flex-col justify-start items-start border dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow hover:shadow-xl transition-all p-4 pb-3 rounded-lg">
          <div className="mb-3">
            <Link to={`/u/${encodeURIComponent(extractUsernameFromName(memo.creator))}`} unstable_viewTransition>
              <span className="w-full flex flex-row justify-start items-center">
                <UserAvatar className="!w-10 !h-10 mr-2" avatarUrl={creator?.avatarUrl} />
                <div className="flex flex-col justify-start items-start gap-1">
                  <span className="text-lg leading-none text-gray-600 max-w-[8em] truncate dark:text-gray-400">{creator?.nickname}</span>
                  <span className="text-sm leading-none text-gray-400 select-none">{getDateTimeString(memo.displayTime)}</span>
                </div>
              </span>
            </Link>
          </div>
          {parentMemo && (
            <div className="w-auto mb-2">
              <Link
                className="px-3 py-1 border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-gray-500 hover:shadow hover:opacity-80"
                to={`/m/${parentMemo.name}`}
                unstable_viewTransition
              >
                <Icon.ArrowUpLeftFromCircle className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                <span className="truncate">{parentMemo.content}</span>
              </Link>
            </div>
          )}
          <MemoContent key={`${memo.id}-${memo.updateTime}`} memoId={memo.id} content={memo.content} readonly={readonly} />
          <MemoResourceListView resources={memo.resources} />
          <MemoRelationListView memo={memo} relations={referenceRelations} />
          <div className="w-full mt-3 flex flex-row justify-between items-center gap-2">
            <div className="flex flex-row justify-start items-center">
              {!readonly && (
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
                  {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC].map((item) => (
                    <Option key={item} value={item} className="whitespace-nowrap">
                      {t(`memo.visibility.${convertVisibilityToString(item).toLowerCase()}` as any)}
                    </Option>
                  ))}
                </Select>
              )}
            </div>
            <div className="flex flex-row sm:justify-end items-center">
              {!readonly && (
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
        <div className="pt-8 pb-16 w-full">
          <div className="relative mx-auto flex-grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
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
                  <MemoView key={`${memo.id}-${memo.displayTime}`} memo={comment} showCreator />
                ))}
              </>
            )}

            {/* Only show comment editor when user login */}
            {currentUser && (
              <MemoEditor key={memo.id} cacheKey={`comment-editor-${memo.id}`} parentMemoId={memo.id} onConfirm={handleCommentCreated} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MemoDetail;
