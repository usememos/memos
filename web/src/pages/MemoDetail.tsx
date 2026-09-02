import { Code, ConnectError } from "@connectrpc/connect";
import { ArrowUpLeftFromCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo as useReactMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import MemoCommentSection, { type MemoCommentSectionHandle } from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoView, { type MemoViewHandle } from "@/components/MemoView";
import { computeCommentAmount } from "@/components/MemoView/MemoViewContext";
import { createMemoNavigationState, type MemoOriginScope, resolveMemoDetailOrigin } from "@/components/MemoView/navigation";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useInfiniteMemoComments, useMemo } from "@/hooks/useMemoQueries";
import { useSharedMemo, withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import { LEGACY_MEMO_COMMENTS_ANCHOR_ID, MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { memoNamePrefix } from "@/lib/resource-names";
import { ROUTES } from "@/router/routes";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { findMemoAnchorTarget } from "@/utils/markdown-manipulation";

const MemoSidebarRegistration = ({
  memo,
  parentMemo,
  from,
  fromScope,
  hasExplicitOrigin,
  commentCount,
  readonly,
  onEdit,
  onCommentsOpen,
  onCommentCreate,
  onShareImageOpen,
}: {
  memo: Memo;
  parentMemo?: Memo;
  from: string;
  fromScope: MemoOriginScope;
  hasExplicitOrigin: boolean;
  commentCount?: number;
  readonly: boolean;
  onEdit: () => void;
  onCommentsOpen: () => void;
  onCommentCreate: () => void;
  onShareImageOpen: () => void;
}) => {
  const { setMemoDetail } = useAppSidebar();

  useEffect(() => {
    setMemoDetail({
      memo,
      parentMemo,
      from,
      fromScope,
      hasExplicitOrigin,
      commentCount,
      readonly,
      onEdit,
      onCommentsOpen,
      onCommentCreate,
      onShareImageOpen,
    });
  }, [
    commentCount,
    from,
    fromScope,
    hasExplicitOrigin,
    memo,
    onCommentCreate,
    onCommentsOpen,
    onEdit,
    onShareImageOpen,
    parentMemo,
    readonly,
    setMemoDetail,
  ]);

  useEffect(() => () => setMemoDetail(undefined), [setMemoDetail]);

  return null;
};

const MemoDetail = () => {
  const { currentUser, isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;
  const memoViewRef = useRef<MemoViewHandle>(null);
  const commentSectionRef = useRef<MemoCommentSectionHandle>(null);
  const handleShareImageOpen = useCallback(() => setShareImageDialogOpen(true), []);
  const handleEdit = useCallback(() => memoViewRef.current?.openEditor(), []);

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
  const hasExplicitOrigin =
    !!locationState && typeof locationState === "object" && typeof (locationState as { from?: unknown }).from === "string";
  const resolvedOrigin = resolveMemoDetailOrigin(locationState, { memoArchived: memo?.state === State.ARCHIVED });
  const parentPage = !hasExplicitOrigin && !currentUser && memo?.state !== State.ARCHIVED ? ROUTES.EXPLORE : resolvedOrigin.parentPage;
  const parentScope = resolvedOrigin.parentScope;
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
  const commentCount = memo ? Math.max(computeCommentAmount(memo), comments.length) : 0;

  const handleCommentsOpen = useCallback(() => {
    commentSectionRef.current?.scrollIntoView();
    window.history.replaceState(window.history.state, "", `${location.pathname}${location.search}#${MEMO_COMMENTS_ANCHOR_ID}`);
  }, [location.pathname, location.search]);

  const handleCommentCreate = useCallback(() => {
    handleCommentsOpen();
    void commentSectionRef.current?.openEditor();
  }, [handleCommentsOpen]);

  // Scroll to the hash target once it's in the DOM. The effect re-runs as the memo loads (footnote
  // anchors) and as comments arrive (comment anchors), since the target may render in either; the
  // ref guards against re-scrolling the same hash on every later comments page-load.
  const scrolledHashRef = useRef("");
  useEffect(() => {
    if (!hash) return;
    const scrollKey = `${memoName}\0${hash}`;
    if (scrolledHashRef.current === scrollKey) return;
    const fragment = decodeURIComponent(hash.slice(1));
    const commentSection = commentSectionRef.current;
    if (commentSection && (fragment === MEMO_COMMENTS_ANCHOR_ID || fragment === LEGACY_MEMO_COMMENTS_ANCHOR_ID)) {
      scrolledHashRef.current = scrollKey;
      commentSection.scrollIntoView();
      return;
    }

    // A legacy #comments link on a share-token page has no comment section. Let it
    // resolve to a historical body heading instead of turning into a dead fragment.
    const el = findMemoAnchorTarget(document, memoName, fragment);
    if (!el) return;
    scrolledHashRef.current = scrollKey;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, memo, memoName, comments]);

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
        <MemoSidebarRegistration
          memo={displayMemo}
          parentMemo={parentMemo}
          from={parentPage}
          fromScope={parentScope}
          hasExplicitOrigin={hasExplicitOrigin}
          commentCount={isShareMode ? undefined : commentCount}
          readonly={isShareMode}
          onEdit={handleEdit}
          onCommentsOpen={handleCommentsOpen}
          onCommentCreate={handleCommentCreate}
          onShareImageOpen={handleShareImageOpen}
        />
        <div className="w-full max-w-2xl px-4 sm:px-6">
          <div className="w-full">
            {!isShareMode && parentMemo && (
              <div className="w-auto inline-block mb-2 md:hidden">
                <Link
                  className="px-3 py-1 border border-border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-muted-foreground hover:shadow hover:opacity-80"
                  to={`/${parentMemo.name}`}
                  state={createMemoNavigationState(parentPage, parentScope)}
                  viewTransition
                >
                  <ArrowUpLeftFromCircleIcon className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                  <span className="truncate">{parentMemo.content}</span>
                </Link>
              </div>
            )}
            <MemoView
              ref={memoViewRef}
              key={displayMemo.name}
              memo={displayMemo}
              compact={false}
              parentPage={parentPage}
              parentScope={parentScope}
              shareImageDialogOpen={shareImageDialogOpen}
              showCreator
              showVisibility
              showPinned
              showSpace
              onShareImageDialogOpenChange={setShareImageDialogOpen}
            />
            {!isShareMode && (
              <MemoCommentSection
                ref={commentSectionRef}
                memo={displayMemo}
                comments={comments}
                commentCount={commentCount}
                parentPage={parentPage}
                parentScope={parentScope}
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
