import { cn } from "@/lib/utils";

interface Props {
  showCreator?: boolean;
  count?: number;
}

const MemoSkeleton = ({ showCreator = false, count = 6 }: Props) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative flex flex-col justify-start items-start bg-card w-full px-4 py-3 mb-2 gap-2 rounded-lg border border-border animate-pulse"
        >
          {/* Header section */}
          <div className="w-full flex flex-row justify-between items-center gap-2">
            <div className="w-auto max-w-[calc(100%-8rem)] grow flex flex-row justify-start items-center">
              {showCreator ? (
                <div className="w-full flex flex-row justify-start items-center gap-2">
                  {/* Avatar skeleton */}
                  <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                  <div className="w-full flex flex-col justify-center items-start gap-1">
                    {/* Creator name skeleton */}
                    <div className="h-4 w-24 bg-muted rounded" />
                    {/* Timestamp skeleton */}
                    <div className="h-3 w-16 bg-muted rounded" />
                  </div>
                </div>
              ) : (
                <div className="h-4 w-32 bg-muted rounded" />
              )}
            </div>
            {/* Action buttons skeleton */}
            <div className="flex flex-row gap-2">
              <div className="w-4 h-4 bg-muted rounded" />
              <div className="w-4 h-4 bg-muted rounded" />
            </div>
          </div>

          {/* Content section */}
          <div className="w-full flex flex-col gap-2">
            {/* Text content skeleton - varied heights for realism */}
            <div className="space-y-2">
              <div className={cn("h-4 bg-muted rounded", index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-4/5" : "w-5/6")} />
              <div className={cn("h-4 bg-muted rounded", index % 2 === 0 ? "w-3/4" : "w-4/5")} />
              {index % 2 === 0 && <div className="h-4 w-2/3 bg-muted rounded" />}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default MemoSkeleton;
