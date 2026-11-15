import { Button, Skeleton } from "@usememos/ui";
import { useTranslate } from "@/utils/i18n";

interface AttachmentLibraryErrorStateProps {
  error?: Error;
  onRetry: () => void;
}

interface AttachmentLibrarySkeletonGridProps {
  count?: number;
}

export const AttachmentLibrarySkeletonGrid = ({ count = 8 }: AttachmentLibrarySkeletonGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[20px] border border-mu-line/60 bg-mu-canvas/90">
          <Skeleton className="aspect-[5/4] h-auto" />
          <div className="space-y-2.5 p-3">
            <Skeleton width="66%" height={16} />
            <Skeleton width="50%" height={12} />
            <Skeleton height={28} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const AttachmentLibraryErrorState = ({ error, onRetry }: AttachmentLibraryErrorStateProps) => {
  const t = useTranslate();

  return (
    <div className="p-6 text-center" role="alert">
      <p className="mu-body text-mu-text-secondary">{error?.message ?? t("attachment-library.errors.load")}</p>
      <Button variant="primary" className="mt-4" onClick={onRetry}>
        {t("attachment-library.actions.retry")}
      </Button>
    </div>
  );
};
