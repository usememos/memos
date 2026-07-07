import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import PagedMemoList from "@/components/PagedMemoList";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { useGroups } from "@/hooks/useGroupQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const GroupTimeline = () => {
  const { name } = useParams();
  const t = useTranslate();
  const { data: groups = [] } = useGroups();

  // Decoding the name for display (e.g. groups/1)
  const groupName = name ? decodeURIComponent(name) : "";

  const currentGroup = groups.find((g) => g.name === groupName);
  const displayName = currentGroup?.displayName || groupName;

  // Since actual group filtering via backend CEL needs the protobuf definitions updated
  // and the CEL compiler updated, we use a fallback filter for demonstration
  const memoFilter = useMemoFilters({
    includeShortcuts: false,
    includePinned: false,
    visibilities: [Visibility.GROUP], // GROUP visibility
    groupName: groupName, // Will compile to group_id == X
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <section className="w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="mb-4">
          <Link to="/groups" className="inline-flex items-center text-sm text-gray-500 hover:text-primary">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            {t("group.back-to-groups")}
          </Link>
        </div>

        <div className="flex items-center justify-start mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <UsersIcon className="w-8 h-8 mr-3 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{displayName}</h1>
            <p className="text-gray-500 mt-1">{t("group.group-timeline")}</p>
          </div>
        </div>

        <div className="w-full">
          {/* Note: This list relies on real Memos from the database. 
              Once the backend group filter is fully deployed, it will only show memos for this group. */}
          <PagedMemoList
            renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility compact />}
            listSort={listSort}
            orderBy={orderBy}
            filter={memoFilter}
            showCreator
          />
        </div>
      </div>
    </section>
  );
};

export default GroupTimeline;
