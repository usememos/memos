import { ArchiveIcon } from "lucide-react";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const user = useCurrentUser();
  const t = useTranslate();

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeMemoViews: true,
    includePinned: false,
  });

  // Get sorting logic using unified hook (pinned first, archived state)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.ARCHIVED,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo, { compact }) => <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showSpace compact={compact} />}
      listSort={listSort}
      state={State.ARCHIVED}
      orderBy={orderBy}
      filter={memoFilter}
      renderLeading={({ useGrid }) => (
        <header className={cn("flex items-center gap-2 px-1", !useGrid && "mb-4")}>
          <ArchiveIcon className="size-5 text-muted-foreground" strokeWidth={1.8} />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("common.archived")}</h1>
        </header>
      )}
    />
  );
};

export default Archived;
