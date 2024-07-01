import { Button } from "@mui/joy";
import clsx from "clsx";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import Icon from "@/components/Icon";
import { MemoDetailSidebar, MemoDetailSidebarDrawer } from "@/components/MemoDetailSidebar";
import showMemoEditorDialog from "@/components/MemoEditor/MemoEditorDialog";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoStore } from "@/store/v1";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const params = useParams();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const uid = params.uid;
  const memo = memoStore.getMemoByUid(uid || "");
  const [parentMemo, setParentMemo] = useState<Memo | undefined>(undefined);
  const commentRelations =
    memo?.relations.filter((relation) => relation.relatedMemo === memo.name && relation.type === MemoRelation_Type.COMMENT) || [];
  const comments = commentRelations.map((relation) => memoStore.getMemoByName(relation.memo)).filter((memo) => memo) as any as Memo[];

  // Prepare memo.
  useEffect(() => {
    if (uid) {
      memoStore.searchMemos(`uid == "${uid}"`).catch((error: ClientError) => {
        toast.error(error.details);
        navigateTo("/403");
      });
    } else {
      navigateTo("/404");
    }
  }, [uid]);

  // Prepare memo comments.
  useEffect(() => {
    if (!memo) {
      return;
    }

    (async () => {
      if (memo.parent) {
        memoStore.getOrFetchMemoByName(memo.parent).then((memo: Memo) => {
          setParentMemo(memo);
        });
      } else {
        setParentMemo(undefined);
      }
      await Promise.all(commentRelations.map((relation) => memoStore.getOrFetchMemoByName(relation.memo)));
    })();
  }, [memo]);

  if (!memo) {
    return null;
  }

  const handleShowCommentEditor = () => {
    showMemoEditorDialog({
      placeholder: t("editor.add-your-comment-here"),
      parentMemoName: memo.name,
      onConfirm: handleCommentCreated,
      cacheKey: `${memo.name}-${memo.updateTime}-comment`,
    });
  };

  const handleCommentCreated = async (memoCommentName: string) => {
    await memoStore.getOrFetchMemoByName(memoCommentName);
    await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <MemoDetailSidebarDrawer memo={memo} />
        </MobileHeader>
      )}
      <div className={clsx("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={clsx(md ? "w-[calc(100%-15rem)]" : "w-full")}>
          {parentMemo && (
            <div className="w-auto inline-block mb-2">
              <Link
                className="px-3 py-1 border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-gray-500 hover:shadow hover:opacity-80"
                to={`/m/${parentMemo.uid}`}
                unstable_viewTransition
              >
                <Icon.ArrowUpLeftFromCircle className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                <span className="truncate">{parentMemo.content}</span>
              </Link>
            </div>
          )}
          <MemoView
            key={`${memo.name}-${memo.displayTime}`}
            className="shadow hover:shadow-md transition-all"
            memo={memo}
            compact={false}
            showCreator
            showVisibility
            showPinned
          />
          <div className="pt-8 pb-16 w-full">
            <h2 id="comments" className="sr-only">
              {t("memo.comment.self")}
            </h2>
            <div className="relative mx-auto flex-grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
              {comments.length === 0 ? (
                currentUser && (
                  <div className="w-full flex flex-row justify-center items-center py-6">
                    <Button
                      variant="plain"
                      color="neutral"
                      endDecorator={<Icon.MessageCircle className="w-5 h-auto text-gray-500" />}
                      onClick={handleShowCommentEditor}
                    >
                      <span className="font-normal text-gray-500">{t("memo.comment.write-a-comment")}</span>
                    </Button>
                  </div>
                )
              ) : (
                <>
                  <div className="w-full flex flex-row justify-between items-center px-3 mb-2">
                    <div className="flex flex-row justify-start items-center">
                      <Icon.MessageCircle className="w-5 h-auto text-gray-400 mr-1" />
                      <span className="text-gray-400 text-sm">{t("memo.comment.self")}</span>
                      <span className="text-gray-400 text-sm ml-1">({comments.length})</span>
                    </div>
                    <Button variant="plain" color="neutral" onClick={handleShowCommentEditor}>
                      <span className="font-normal text-gray-500">{t("memo.comment.write-a-comment")}</span>
                    </Button>
                  </div>
                  {comments.map((comment) => (
                    <MemoView key={`${comment.name}-${comment.displayTime}`} memo={comment} showCreator compact />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        {md && (
          <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
            <MemoDetailSidebar className="py-6" memo={memo} />
          </div>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
