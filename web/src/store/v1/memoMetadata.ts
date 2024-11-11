import { uniqueId } from "lodash-es";
import { Location } from "react-router-dom";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { Routes } from "@/router";
import { Memo, MemoView } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";

// Set the maximum number of memos to fetch.
const DEFAULT_MEMO_PAGE_SIZE = 1000000;

interface State {
  // stateId is used to identify the store instance state.
  // It should be update when any state change.
  stateId: string;
  dataMapByName: Record<string, Memo>;
}

const getDefaultState = (): State => ({
  stateId: uniqueId(),
  dataMapByName: {},
});

export const useMemoMetadataStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchMemoMetadata: async (params: { user?: User; location?: Location<any> }) => {
      const filters = [`row_status == "NORMAL"`];
      if (params.user) {
        if (params.location?.pathname === Routes.EXPLORE) {
          filters.push(`visibilities == ["PUBLIC", "PROTECTED"]`);
        }
        filters.push(`creator == "${params.user.name}"`);
      } else {
        filters.push(`visibilities == ["PUBLIC"]`);
      }
      const { memos, nextPageToken } = await memoServiceClient.listMemos({
        filter: filters.join(" && "),
        view: MemoView.MEMO_VIEW_METADATA_ONLY,
        pageSize: DEFAULT_MEMO_PAGE_SIZE,
      });
      const memoMap = { ...get().dataMapByName };
      for (const memo of memos) {
        memoMap[memo.name] = memo;
      }
      set({ stateId: uniqueId(), dataMapByName: memoMap });
      return { memos, nextPageToken };
    },
  })),
);

export const useMemoTagList = () => {
  const memoStore = useMemoMetadataStore();
  const data = Object.values(memoStore.getState().dataMapByName);
  const tagAmounts: Record<string, number> = {};
  data.forEach((memo) => {
    memo.property?.tags.forEach((tag) => {
      if (tagAmounts[tag]) {
        tagAmounts[tag] += 1;
      } else {
        tagAmounts[tag] = 1;
      }
    });
  });
  return tagAmounts;
};
