import { ConnectError } from "@connectrpc/connect";
import { ArrowUpLeftFromCircleIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useParams } from "react-router-dom";
import { MemoDetailSidebar, MemoDetailSidebarDrawer } from "@/components/MemoDetailSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { memoNamePrefix } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemo, useMemoComments } from "@/hooks/useMemoQueries";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const params = useParams();
  const navigateTo = useNavigateTo();
  const { state: locationState } = useLocation();
  const currentUser = useCurrentUser();
  const uid = params.uid;
  const memoName = `${memoNamePrefix}${uid}`;
  const [showCommentEditor, setShowCommentEditor] = useState(false);

  // Fetch main memo with React Query
  const { data: memo, error, isLoading } = useMemo(memoName, { enabled: !!memoName });

  // Handle errors
  if (error) {
    toast.error((error as ConnectError).message);
    navigateTo("/403");
  }

  // Fetch parent memo if exists
  const { data: parentMemo } = useMemo(memo?.parent || "", {
    enabled: !!memo?.parent,
  });

  // Fetch all comments for this memo in a single query
  const { data: commentsResponse } = useMemoComments(memoName, {
    enabled: !!memo,
  });
  const comments = commentsResponse?.memos || [];

  const showCreateCommentButton = currentUser && !showCommentEditor;

  if (isLoading || !memo) {
    return null;
  }

  const handleShowCommentEditor = () => {
    setShowCommentEditor(true);
  };

  const handleCommentCreated = async (_memoCommentName: string) => {
    // React Query will auto-refetch due to invalidation in the mutation
    setShowCommentEditor(false);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <MemoDetailSidebarDrawer memo={memo} parentPage={locationState?.from} />
        </MobileHeader>
      )}
      <div className={cn("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={cn("w-full md:w-[calc(100%-15rem)]")}>
          {parentMemo && (
            <div className="w-auto inline-block mb-2">
              <Link
                className="px-3 py-1 border border-border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-muted-foreground hover:shadow hover:opacity-80"
                to={`/${parentMemo.name}`}
                state={locationState}
                viewTransition
              >
                <ArrowUpLeftFromCircleIcon className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                <span className="truncate">{parentMemo.content}</span>
              </Link>
            </div>
          )}
          <MemoView
            key={`${memo.name}-${memo.displayTime}`}
            className="shadow hover:shadow-md transition-all"
            memo={memo}
            compact={false}
            parentPage={locationState?.from}
            showCreator
            showVisibility
            showPinned
          />
          <div className="pt-8 pb-16 w-full">
            <h2 id="comments" className="sr-only">
              {t("memo.comment.self")}
            </h2>
            <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
              {comments.length === 0 ? (
                showCreateCommentButton && (
                  <div className="w-full flex flex-row justify-center items-center py-6">
                    <Button variant="ghost" onClick={handleShowCommentEditor}>
                      <span className="text-muted-foreground">{t("memo.comment.write-a-comment")}</span>
                      <MessageCircleIcon className="ml-2 w-5 h-auto text-muted-foreground" />
                    </Button>
                  </div>
                )
              ) : (
                <>
                  <div className="w-full flex flex-row justify-between items-center h-8 pl-3 mb-2">
                    <div className="flex flex-row justify-start items-center">
                      <MessageCircleIcon className="w-5 h-auto text-muted-foreground mr-1" />
                      <span className="text-muted-foreground text-sm">{t("memo.comment.self")}</span>
                      <span className="text-muted-foreground text-sm ml-1">({comments.length})</span>
                    </div>
                    {showCreateCommentButton && (
                      <Button variant="ghost" className="text-muted-foreground" onClick={handleShowCommentEditor}>
                        {t("memo.comment.write-a-comment")}
                      </Button>
                    )}
                  </div>
                  {comments.map((comment) => (
                    <MemoView
                      key={`${comment.name}-${comment.displayTime}`}
                      memo={comment}
                      parentPage={locationState?.from}
                      showCreator
                      compact
                    />
                  ))}
                </>
              )}
            </div>
            {showCommentEditor && (
              <div className="w-full">
                <MemoEditor
                  cacheKey={`${memo.name}-${memo.updateTime}-comment`}
                  placeholder={t("editor.add-your-comment-here")}
                  parentMemoName={memo.name}
                  autoFocus
                  onConfirm={handleCommentCreated}
                  onCancel={() => setShowCommentEditor(false)}
                />
              </div>
            )}
          </div>
        </div>
        {md && (
          <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
            <MemoDetailSidebar className="py-6" memo={memo} parentPage={locationState?.from} />
          </div>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
