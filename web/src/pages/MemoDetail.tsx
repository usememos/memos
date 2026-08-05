import { Code, ConnectError } from "@connectrpc/connect";
import { ArrowUpLeftFromCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo as useReactMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoView from "@/components/MemoView";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useInfiniteMemoComments, useMemo } from "@/hooks/useMemoQueries";
import { useSharedMemo, withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import { memoNamePrefix } from "@/lib/resource-names";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const MemoSidebarRegistration = ({
  memo,
  from,
  readonly,
  onShareImageOpen,
}: {
  memo: Memo;
  from?: string;
  readonly: boolean;
  onShareImageOpen: () => void;
}) => {
  const { setMemoDetail } = useAppSidebar();

  useEffect(() => {
    setMemoDetail({ memo, from, readonly, onShareImageOpen });
  }, [from, memo, onShareImageOpen, readonly, setMemoDetail]);

  useEffect(() => () => setMemoDetail(undefined), [setMemoDetail]);

  return null;
};

const MemoDetail = () => {
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;
  const parentPage = typeof locationState?.from === "string" ? locationState.from : undefined;
  const handleShareImageOpen = useCallback(() => setShareImageDialogOpen(true), []);

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
  const displayMemo = useReactMemo(() => {
    if (!memo) return undefined;
    if (!isShareMode) return memo;
    return { ...memo, attachments: withShareAttachmentLinks(memo.attachments as Attachment[], shareToken!) };
  }, [isShareMode, memo, shareToken]);

  useMemoDetailError({
    error: error as Error | null,
  });

  const { data: parentMemo } = useMemo(memo?.parent || "", {
    enabled: !isShareMode && !!memo?.parent,
  });

  const {
    data: comments = [],
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useInfiniteMemoComments(memoName, {
    enabled: !isShareMode && !!memo,
  });

  // Scroll to the hash target once it's in the DOM. The effect re-runs as the memo loads (footnote
  // anchors) and as comments arrive (comment anchors), since the target may render in either; the
  // ref guards against re-scrolling the same hash on every later comments page-load.
  const scrolledHashRef = useRef("");
  useEffect(() => {
    if (!hash || scrolledHashRef.current === hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    scrolledHashRef.current = hash;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, memo, comments]);

  if (isShareMode) {
    const isNotFound = error instanceof ConnectError && (error.code === Code.NotFound || error.code === Code.Unauthenticated);
    if (isNotFound || (!isLoading && !memo)) {
      return <Navigate to="/404" replace />;
    }
  }

  // Start the permitted requests as soon as routing is unlocked, but do not
  // expose content before tag-blur and instance display settings settle.
  if (isLoading || !memo || !displayMemo || !authInitialized || !instanceInitialized) {
    return null;
  }
  const mentionResolutionContents = [displayMemo.content, ...comments.map((comment) => comment.content)];
  const userResolutionNames = Array.from(
    new Set([displayMemo, ...comments].flatMap((item) => [item.creator, ...(item.reactions ?? []).map((reaction) => reaction.creator)])),
  );
  return (
    <section className="@container flex min-h-full w-full flex-col items-center pb-8 pt-3 md:pt-6">
      <MentionResolutionProvider contents={mentionResolutionContents} userNames={userResolutionNames}>
        <MemoSidebarRegistration memo={displayMemo} from={parentPage} readonly={isShareMode} onShareImageOpen={handleShareImageOpen} />
        <div className="w-full max-w-2xl px-4 sm:px-6">
          <div className="w-full">
            {!isShareMode && parentMemo && (
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
              parentPage={parentPage}
              shareImageDialogOpen={shareImageDialogOpen}
              showCreator
              showVisibility
              showPinned
              onShareImageDialogOpenChange={setShareImageDialogOpen}
            />
            {!isShareMode && (
              <MemoCommentSection
                memo={displayMemo}
                comments={comments}
                parentPage={parentPage}
                hasMoreComments={hasNextComments}
                isFetchingMoreComments={isFetchingNextComments}
                onLoadMoreComments={fetchNextComments}
              />
            )}
          </div>
        </div>
      </MentionResolutionProvider>
    </section>
  );
};

export default MemoDetail;
