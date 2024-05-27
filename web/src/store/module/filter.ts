import { Visibility } from "@/types/proto/api/v1/memo_service";
import store, { useAppSelector } from "..";
import { MemoPropertyFilter, setFilter, setMemoPropertyFilter } from "../reducer/filter";

export const useFilterStore = () => {
  const state = useAppSelector((state) => state.filter);

  return {
    state,
    getState: () => {
      return store.getState().filter;
    },
    clearFilter: () => {
      store.dispatch(
        setFilter({
          tag: undefined,
          text: undefined,
          visibility: undefined,
          memoPropertyFilter: undefined,
        }),
      );
    },
    setTextFilter: (text?: string) => {
      store.dispatch(
        setFilter({
          text: text,
        }),
      );
    },
    setTagFilter: (tag?: string) => {
      store.dispatch(
        setFilter({
          tag: tag,
        }),
      );
    },
    setMemoVisibilityFilter: (visibility?: Visibility) => {
      store.dispatch(
        setFilter({
          visibility: visibility,
        }),
      );
    },
    setMemoPropertyFilter: (memoPropertyFilter: Partial<MemoPropertyFilter>) => {
      store.dispatch(
        setMemoPropertyFilter({
          ...memoPropertyFilter,
        }),
      );
    },
  };
};
