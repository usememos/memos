import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useFilterStore, useMemoStore } from "@/store/module";
import { TAG_REG } from "@/labs/marked/parser";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import useLoading from "@/hooks/useLoading";
import MemoFilter from "@/components/MemoFilter";
import Memo from "@/components/Memo";
import MobileHeader from "@/components/MobileHeader";
import Empty from "@/components/Empty";

interface State {
  memos: Memo[];
}

const Explore = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const filter = filterStore.state;
  const [state, setState] = useState<State>({
    memos: [],
  });
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const loadingState = useLoading();

  useEffect(() => {
    memoStore.fetchAllMemos(DEFAULT_MEMO_LIMIT, 0).then((memos) => {
      if (memos.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      }
      setState({
        memos,
      });
      loadingState.setFinish();
    });
  }, [location]);

  const { tag: tagQuery, text: textQuery } = filter;
  const showMemoFilter = Boolean(tagQuery || textQuery);

  const shownMemos = showMemoFilter
    ? state.memos.filter((memo) => {
        let shouldShow = true;

        if (tagQuery) {
          const tagsSet = new Set<string>();
          for (const t of Array.from(memo.content.match(new RegExp(TAG_REG, "g")) ?? [])) {
            const tag = t.replace(TAG_REG, "$1").trim();
            const items = tag.split("/");
            let temp = "";
            for (const i of items) {
              temp += i;
              tagsSet.add(temp);
              temp += "/";
            }
          }
          if (!tagsSet.has(tagQuery)) {
            shouldShow = false;
          }
        }
        return shouldShow;
      })
    : state.memos;

  const sortedMemos = shownMemos.filter((m) => m.rowStatus === "NORMAL");

  const handleFetchMoreClick = async () => {
    try {
      const fetchedMemos = await memoStore.fetchAllMemos(DEFAULT_MEMO_LIMIT, state.memos.length);
      if (fetchedMemos.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }
      setState({
        memos: state.memos.concat(fetchedMemos),
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  return (
    <section className="w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      {!loadingState.isLoading && (
        <main className="relative w-full h-auto flex flex-col justify-start items-start">
          <MemoFilter />
          {sortedMemos.map((memo) => {
            return <Memo key={`${memo.id}-${memo.displayTs}`} memo={memo} showCreator />;
          })}
          {isComplete ? (
            state.memos.length === 0 && (
              <div className="w-full mt-16 mb-8 flex flex-col justify-center items-center italic">
                <Empty />
                <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
              </div>
            )
          ) : (
            <p className="m-auto text-center mt-4 italic cursor-pointer text-gray-500 hover:text-green-600" onClick={handleFetchMoreClick}>
              {t("memo.fetch-more")}
            </p>
          )}
        </main>
      )}
    </section>
  );
};

export default Explore;
