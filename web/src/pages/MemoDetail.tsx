import { ArrowUpLeftFromCircleIcon } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MemoDetailSidebar, MemoDetailSidebarDrawer } from "@/components/MemoDetailSidebar";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { memoNamePrefix } from "@/helpers/resource-names";
import useMediaQuery from "@/hooks/useMediaQuery";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useMemo, useMemoComments } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";

const MemoDetail = () => {
  const md = useMediaQuery("md");
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;
  const memoName = `${memoNamePrefix}${params.uid}`;

  const { data: memo, error, isLoading } = useMemo(memoName, { enabled: !!memoName });

  useMemoDetailError({
    error: error as Error | null,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
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

  if (isLoading || !memo) {
    return null;
  }

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <MemoDetailSidebarDrawer memo={memo} />
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
            memo={memo}
            compact={false}
            parentPage={locationState?.from}
            showCreator
            showVisibility
            showPinned
          />
          <MemoCommentSection memo={memo} comments={comments} parentPage={locationState?.from} />
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
