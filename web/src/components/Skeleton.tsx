import { cn } from "@/lib/utils";

interface SkeletonProps {
  showCreator?: boolean;
  count?: number;
}

const skeletonBase = "bg-muted/70 rounded animate-pulse";

const MemoCardSkeleton = ({ showCreator, index }: { showCreator?: boolean; index: number }) => (
  <div className="relative flex flex-col bg-card w-full px-4 py-3 mb-2 gap-2 rounded-lg border border-border">
    <div className="w-full flex justify-between items-center gap-2">
      <div className="grow flex items-center max-w-[calc(100%-8rem)]">
        {showCreator ? (
          <div className="w-full flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-full shrink-0", skeletonBase)} />
            <div className="flex flex-col gap-1">
              <div className={cn("h-4 w-24", skeletonBase)} />
              <div className={cn("h-3 w-16", skeletonBase)} />
            </div>
          </div>
        ) : (
          <div className={cn("h-4 w-32", skeletonBase)} />
        )}
      </div>
      <div className="flex gap-2">
        <div className={cn("w-4 h-4", skeletonBase)} />
        <div className={cn("w-4 h-4", skeletonBase)} />
      </div>
    </div>
    <div className="space-y-2">
      <div className={cn("h-4", skeletonBase, index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-4/5" : "w-5/6")} />
      <div className={cn("h-4", skeletonBase, index % 2 === 0 ? "w-3/4" : "w-4/5")} />
      {index % 2 === 0 && <div className={cn("h-4 w-2/3", skeletonBase)} />}
    </div>
  </div>
);

/**
 * Memo list loading skeleton - shows card structure while loading.
 * Only use for memo lists in PagedMemoList component.
 */
const Skeleton = ({ showCreator = false, count = 4 }: SkeletonProps) => (
  <div className="w-full max-w-2xl mx-auto">
    {Array.from({ length: count }, (_, i) => (
      <MemoCardSkeleton key={i} showCreator={showCreator} index={i} />
    ))}
  </div>
);

export default Skeleton;
