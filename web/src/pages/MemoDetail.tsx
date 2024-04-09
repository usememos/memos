import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import Icon from "@/components/Icon";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { MemoNamePrefix, useMemoStore } from "@/store/v1";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
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
      if (memo.parentId) {
        memoStore.getOrFetchMemoByName(`${MemoNamePrefix}${memo.parentId}`).then((memo: Memo) => {
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

  const handleCommentCreated = async (memoCommentName: string) => {
    await memoStore.getOrFetchMemoByName(memoCommentName);
    await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
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
          className="shadow hover:shadow-xl transition-all"
          memo={memo}
          compact={false}
          showCreator
          showVisibility
          showPinned
        />
        <div className="pt-8 pb-16 w-full">
          <h2 id="comments" className="sr-only">
            Comments
          </h2>
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
                  <MemoView key={`${memo.name}-${memo.displayTime}`} memo={comment} showCreator />
                ))}
              </>
            )}

            {/* Only show comment editor when user login */}
            {currentUser && (
              <MemoEditor
                key={memo.name}
                cacheKey={`comment-editor-${memo.name}`}
                placeholder={t("editor.add-your-comment-here")}
                parentMemoName={memo.name}
                onConfirm={handleCommentCreated}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MemoDetail;
