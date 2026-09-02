import { useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, CheckIcon, ImportIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import BookmarksImportDialog from "@/components/BookmarksImport/BookmarksImportDialog";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { memoServiceClient } from "@/connect";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
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
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
}) => {
  const className = cn(
    "flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground sm:h-auto sm:w-auto sm:px-2 sm:py-1",
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
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
};

/** Hairline divider separating header action groups. */
const HeaderDivider = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;

interface CoverRefreshState {
  status: "idle" | "running" | "done" | "error";
  updated: number;
  failed: number;
  pages: number;
}

const IDLE_REFRESH: CoverRefreshState = { status: "idle", updated: 0, failed: 0, pages: 0 };

const Bookmarks = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { memoFilter: spaceFilter } = useSpaceContext();
  const [importOpen, setImportOpen] = useState(false);
  const [coverRefresh, setCoverRefresh] = useState<CoverRefreshState>(IDLE_REFRESH);
  const queryClient = useQueryClient();

  const refreshCovers = async () => {
    setCoverRefresh({ ...IDLE_REFRESH, status: "running" });
    try {
      // The server pages through the backlog; keep calling until nextPageToken is empty.
      let updated = 0;
      let failed = 0;
      let pages = 0;
      let pageToken = "";
      for (;;) {
        const response = await memoServiceClient.refreshMemoLinkCovers({ pageToken });
        updated += response.updatedLinks;
        failed += response.failedLinks;
        pages++;
        setCoverRefresh({ status: "running", updated, failed, pages });
        pageToken = response.nextPageToken;
        if (!pageToken) break;
      }
      await queryClient.invalidateQueries({ queryKey: ["memos"] });
      setCoverRefresh({ status: "done", updated, failed, pages });
    } catch (error) {
      console.error("link cover refresh failed", error);
      setCoverRefresh({ ...IDLE_REFRESH, status: "error" });
    }
  };

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
          <header className={cn("flex flex-col gap-2 px-1", !useGrid && "mb-4")}>
            <div className="flex items-center gap-2">
              <BookmarkIcon className="size-5 text-muted-foreground" strokeWidth={1.8} />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("common.bookmarks")}</h1>
              <div className="ml-auto flex items-center">
                <HeaderAction
                  to={ROUTES.BOOKMARK}
                  icon={<PlusIcon className="size-3.5" strokeWidth={1.8} />}
                  label={t("common.save-link")}
                />
                <HeaderDivider />
                <HeaderAction
                  icon={<ImportIcon className="size-3.5" strokeWidth={1.8} />}
                  label={t("bookmarks.import")}
                  onClick={() => setImportOpen(true)}
                />
                <HeaderDivider />
                <HeaderAction
                  icon={<RefreshCwIcon className={cn("size-3.5", coverRefresh.status === "running" && "animate-spin")} strokeWidth={1.8} />}
                  label={coverRefresh.status === "running" ? t("bookmarks.refreshing-covers") : t("bookmarks.refresh-covers")}
                  onClick={() => void refreshCovers()}
                  disabled={coverRefresh.status === "running"}
                />
              </div>
            </div>
            {refreshStatus !== null ? (
              <p aria-live="polite" className="flex items-center gap-1.5 pl-7 font-mono text-xs text-muted-foreground">
                {coverRefresh.status === "done" && <CheckIcon className="size-3" strokeWidth={2} />}
                {refreshStatus}
              </p>
            ) : null}
          </header>
        )}
      />
      <BookmarksImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export default Bookmarks;
