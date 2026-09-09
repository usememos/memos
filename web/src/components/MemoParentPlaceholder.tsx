import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";

export type MemoParentStatus = "loading" | "unavailable" | "error";

export default function MemoParentPlaceholder({ status, onRetry }: { status: MemoParentStatus; onRetry?: () => void }) {
  const t = useTranslate();
  return (
    <div className="px-2 py-1.5 text-xs text-muted-foreground" role="status">
      <p>{t(status === "loading" ? "memo.parent-loading" : status === "error" ? "memo.parent-load-error" : "memo.parent-unavailable")}</p>
      {status === "unavailable" && <p className="mt-1 leading-5">{t("memo.parent-unavailable-description")}</p>}
      {status === "error" && onRetry && (
        <Button variant="ghost" size="sm" className="mt-1" onClick={onRetry}>
          {t("search.retry")}
        </Button>
      )}
    </div>
  );
}
