import { BookmarkIcon, CheckIcon, ImportIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import BookmarksImportDialog from "@/components/BookmarksImport/BookmarksImportDialog";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { useBookmarkCoverRefresh } from "@/hooks/useBookmarkCoverRefresh";
import useCurrentUser from "@/hooks/useCurrentUser";
import { combineCELFilters } from "@/lib/cel-filter";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

/** Shared quiet header action: 13px muted label, hairline hover wash, no chrome. */
const HeaderAction = ({
  icon,
  label,
  onClick,
  to,
  disabled,
  primary,
  busy,
  description,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  primary?: boolean;
  busy?: boolean;
  description?: string;
}) => {
  const className = cn(
    "flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-8 sm:w-auto sm:px-2.5",
    primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );
  const content = (
    <>
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-busy={busy} title={description ?? label}>
      {content}
    </button>
  );
};

const Bookmarks = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { memoFilter: spaceFilter } = useSpaceContext();
  const [importOpen, setImportOpen] = useState(false);
  const { coverRefresh, refreshCovers, cancelRefresh } = useBookmarkCoverRefresh();

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeMemoViews: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  const refreshStatus =
    coverRefresh.status === "running"
      ? coverRefresh.failed > 0
        ? t("bookmarks.refreshing-covers-progress", {
            updated: coverRefresh.updated.toString(),
            failed: coverRefresh.failed.toString(),
            pages: coverRefresh.pages.toString(),
          })
        : t("bookmarks.refreshing-covers-progress-no-failed", {
            updated: coverRefresh.updated.toString(),
            pages: coverRefresh.pages.toString(),
          })
      : coverRefresh.status === "done"
        ? coverRefresh.failed > 0
          ? t("bookmarks.refresh-covers-result", { updated: coverRefresh.updated.toString(), failed: coverRefresh.failed.toString() })
          : t("bookmarks.refresh-covers-updated", { updated: coverRefresh.updated.toString() })
        : coverRefresh.status === "error"
          ? t("bookmarks.refresh-covers-error")
          : coverRefresh.status === "cancelled"
            ? t("bookmarks.refresh-covers-cancelled")
            : null;

  return (
    <>
      <PagedMemoList
        renderer={(memo: Memo, { compact, variant }) => (
          <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showSpace compact={compact} variant={variant} />
        )}
        listSort={listSort}
        state={State.NORMAL}
        orderBy={orderBy}
        filter={memoFilter}
        contextFilter={combineCELFilters("has_link", spaceFilter)}
        renderLeading={({ useGrid }) => (
          <header className={cn("flex flex-col gap-2 border-b border-border/80 px-1 pb-3", !useGrid && "mb-4")}>
            <div className="flex items-center gap-2">
              <BookmarkIcon className="size-5 text-muted-foreground" strokeWidth={1.8} />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("common.bookmarks")}</h1>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <HeaderAction
                  to={ROUTES.BOOKMARK}
                  icon={<PlusIcon className="size-3.5" strokeWidth={1.8} />}
                  label={t("common.save-link")}
                  primary
                />
                <HeaderAction
                  icon={<ImportIcon className="size-3.5" strokeWidth={1.8} />}
                  label={t("bookmarks.import")}
                  onClick={() => setImportOpen(true)}
                />
                <HeaderAction
                  icon={<RefreshCwIcon className={cn("size-3.5", coverRefresh.status === "running" && "animate-spin")} strokeWidth={1.8} />}
                  label={coverRefresh.status === "running" ? t("bookmarks.refreshing-covers") : t("bookmarks.refresh-covers")}
                  onClick={() => void refreshCovers()}
                  disabled={coverRefresh.status === "running"}
                  busy={coverRefresh.status === "running"}
                  description={t("bookmarks.refresh-covers-scope")}
                />
              </div>
            </div>
            {refreshStatus !== null ? (
              <div
                aria-live="polite"
                aria-atomic="true"
                className={cn(
                  "flex items-center gap-1.5 self-end pr-1 font-mono text-xs text-muted-foreground",
                  coverRefresh.status === "done" && coverRefresh.failed === 0 && "text-success",
                  coverRefresh.status === "done" && coverRefresh.failed > 0 && "text-warning",
                  coverRefresh.status === "error" && "text-destructive",
                )}
              >
                {coverRefresh.status === "done" && <CheckIcon className="size-3" strokeWidth={2} />}
                {refreshStatus}
                {coverRefresh.status === "running" && (
                  <button
                    type="button"
                    onClick={cancelRefresh}
                    className="shrink-0 rounded-md p-2 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            ) : null}
          </header>
        )}
      />
      <BookmarksImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export default Bookmarks;
