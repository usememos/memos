import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { MemoRenderContext } from "@/components/MasonryView";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { viewStore, workspaceStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";

const Archived = observer(() => {
  const user = useCurrentUser();

  // Build filter from active filters
  const buildMemoFilter = () => {
    const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      } else if (filter.factor === "property.hasLink") {
        conditions.push(`has_link`);
      } else if (filter.factor === "property.hasTaskList") {
        conditions.push(`has_task_list`);
      } else if (filter.factor === "property.hasCode") {
        conditions.push(`has_code`);
      } else if (filter.factor === "displayTime") {
        const displayWithUpdateTime = workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.MEMO_RELATED).memoRelatedSetting
          ?.displayWithUpdateTime;
        const factor = displayWithUpdateTime ? "updated_ts" : "created_ts";
        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;
        conditions.push(`${factor} >= ${timestampAfter} && ${factor} < ${timestampAfter + 60 * 60 * 24}`);
      }
    }
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  };

  const memoFilter = buildMemoFilter();

  return (
    <PagedMemoList
      renderer={(memo: Memo, context?: MemoRenderContext) => (
        <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact={context?.compact} />
      )}
      listSort={(memos: Memo[]) =>
        memos
          .filter((memo) => memo.state === State.ARCHIVED)
          .sort((a, b) => {
            // First, sort by pinned status (pinned memos first)
            if (a.pinned !== b.pinned) {
              return b.pinned ? 1 : -1;
            }
            // Then sort by display time
            return viewStore.state.orderByTimeAsc
              ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
              : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix();
          })
      }
      state={State.ARCHIVED}
      orderBy={viewStore.state.orderByTimeAsc ? "pinned desc, display_time asc" : "pinned desc, display_time desc"}
      filter={memoFilter}
    />
  );
});

export default Archived;
