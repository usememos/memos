import { BookmarkIcon, PlusIcon } from "lucide-react";
import { Link } from "react-router-dom";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { combineCELFilters } from "@/lib/cel-filter";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Bookmarks = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { memoFilter: spaceFilter } = useSpaceContext();

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeMemoViews: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
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
        <header className={cn("flex items-center gap-2 px-1", !useGrid && "mb-4")}>
          <BookmarkIcon className="size-5 text-muted-foreground" strokeWidth={1.8} />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("common.bookmarks")}</h1>
          <Link
            to={ROUTES.BOOKMARK}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <PlusIcon className="size-3.5" strokeWidth={1.8} />
            {t("common.save-link")}
          </Link>
        </header>
      )}
    />
  );
};

export default Bookmarks;
