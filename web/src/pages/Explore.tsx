import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import PagedMemoList from "@/components/PagedMemoList";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { viewStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Explore = observer(() => {
  const { md } = useResponsiveWidth();

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <PagedMemoList
          renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility compact />}
          listSort={(memos: Memo[]) =>
            memos
              .filter((memo) => memo.state === State.NORMAL)
              .sort((a, b) =>
                viewStore.state.orderByTimeAsc
                  ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                  : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
              )
          }
          orderBy={viewStore.state.orderByTimeAsc ? "display_time asc" : "display_time desc"}
        />
      </div>
    </section>
  );
});

export default Explore;
