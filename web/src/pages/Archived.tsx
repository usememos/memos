import dayjs from "dayjs";
import { ArchiveIcon } from "lucide-react";
import { useMemo } from "react";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import PagedMemoList from "@/components/PagedMemoList";
import SearchBar from "@/components/SearchBar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoFilterStore } from "@/store/v1";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();

  const memoListFilter = useMemo(() => {
    const filters = [`creator == "${user.name}"`, `state == "ARCHIVED"`];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
      }
    }
    if (memoFilterStore.orderByTimeAsc) {
      filters.push(`order_by_time_asc == true`);
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagSearch.length > 0) {
      filters.push(`tag_search == [${tagSearch.join(", ")}]`);
    }
    return filters.join(" && ");
  }, [user, memoFilterStore.filters]);

  return (
    <section id="archived" className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full flex flex-col justify-start items-start">
          <div className="w-full flex flex-row justify-between items-center mb-2">
            <div className="flex flex-row justify-start items-center gap-1">
              <ArchiveIcon className="w-5 h-auto opacity-70 shrink-0" />
              <span>{t("common.archived")}</span>
            </div>
            <div className="w-44">
              <SearchBar />
            </div>
          </div>
          <MemoFilters />
          <PagedMemoList
            renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact />}
            listSort={(memos: Memo[]) =>
              memos
                .filter((memo) => memo.state === State.ARCHIVED)
                .sort((a, b) =>
                  memoFilterStore.orderByTimeAsc
                    ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                    : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
                )
            }
            filter={memoListFilter}
          />
        </div>
      </div>
    </section>
  );
};

export default Archived;
