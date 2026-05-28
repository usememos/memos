import { Code, ConnectError } from "@connectrpc/connect";
import { ArrowUpLeftFromCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import { MemoDetailSidebar, MemoDetailSidebarDrawer } from "@/components/MemoDetailSidebar";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { memoNamePrefix } from "@/helpers/resource-names";
import useMediaQuery from "@/hooks/useMediaQuery";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useMemo, useMemoComments } from "@/hooks/useMemoQueries";
import { useSharedMemo, withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

const MemoDetail = () => {
  const md = useMediaQuery("md");
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;

  // Detect share mode from the route parameter.
  const shareToken = params.token;
  const isShareMode = !!shareToken;

  // Primary memo fetch — share token or direct name.
  const memoNameFromParams = params.uid ? `${memoNamePrefix}${params.uid}` : "";
  const {
    data: memoFromDirect,
    error: directError,
    isLoading: directLoading,
  } = useMemo(memoNameFromParams, { enabled: !isShareMode && !!memoNameFromParams });
  const { data: memoFromShare, error: shareError, isLoading: shareLoading } = useSharedMemo(shareToken ?? "", { enabled: isShareMode });

  const memo = isShareMode ? memoFromShare : memoFromDirect;
  const error = isShareMode ? shareError : directError;
  const isLoading = isShareMode ? shareLoading : directLoading;
  const memoName = memo?.name ?? memoNameFromParams;

  useMemoDetailError({
    error: error as Error | null,
  });

  const { data: parentMemo } = useMemo(memo?.parent || "", {
    enabled: !!memo?.parent,
  });

  const { data: commentsResponse } = useMemoComments(memoName, {
    enabled: !!memo,
  });
  const comments = commentsResponse?.memos || [];

  useEffect(() => {
    if (!hash || comments.length === 0) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, comments]);

  if (isShareMode) {
    const isNotFound = error instanceof ConnectError && (error.code === Code.NotFound || error.code === Code.Unauthenticated);
    if (isNotFound || (!isLoading && !memo)) {
      return <Navigate to="/404" replace />;
    }
  }

  if (isLoading || !memo) {
    return null;
  }

  // In share mode, rewrite attachment URLs to include the share token for unauthenticated access.
  const displayMemo = isShareMode
    ? { ...memo, attachments: withShareAttachmentLinks(memo.attachments as Attachment[], shareToken!) }
    : memo;
  const mentionResolutionContents = [displayMemo.content, ...comments.map((comment) => comment.content)];

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <MemoDetailSidebarDrawer memo={displayMemo} onShareImageOpen={() => setShareImageDialogOpen(true)} />
        </MobileHeader>
      )}
      <MentionResolutionProvider contents={mentionResolutionContents}>
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
              key={`${displayMemo.name}-${displayMemo.updateTime}`}
              memo={displayMemo}
              compact={false}
              parentPage={locationState?.from}
              shareImageDialogOpen={shareImageDialogOpen}
              showCreator
              showVisibility
              showPinned
              onShareImageDialogOpenChange={setShareImageDialogOpen}
            />
            <MemoCommentSection memo={displayMemo} comments={comments} parentPage={locationState?.from} />
          </div>
          {md && (
            <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
              <MemoDetailSidebar className="py-6" memo={displayMemo} onShareImageOpen={() => setShareImageDialogOpen(true)} />
            </div>
          )}
        </div>
      </MentionResolutionProvider>
    </section>
  );
};

export default MemoDetail;
