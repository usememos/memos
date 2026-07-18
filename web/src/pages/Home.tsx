import { useMemo } from "react";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { isInitialized } = useInstance();
  const { filters } = useMemoFilterContext();
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showPinned compact={compact} />
          )}
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          enabled={isInitialized}
          renderLeading={({ useGrid }) => (
            <MemoEditor
              className={useGrid ? undefined : "mb-2"}
              cacheKey="home-memo-editor"
              placeholder={t("editor.any-thoughts")}
              defaultCreateTime={defaultCreateTime}
            />
          )}
        />
      </NewMemoProvider>
    </div>
  );
};

export default Home;
