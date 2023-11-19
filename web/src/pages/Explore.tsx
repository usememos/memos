import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import Empty from "@/components/Empty";
import Memo from "@/components/Memo";
import MemoFilter from "@/components/MemoFilter";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { TAG_REG } from "@/labs/marked/parser";
import { useFilterStore, useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const filter = filterStore.state;
  const { loadingStatus, memos } = memoStore.state;
  const { tag: tagQuery, text: textQuery } = filter;
  const showMemoFilter = Boolean(tagQuery || textQuery);
  const fetchMoreRef = useRef<HTMLSpanElement>(null);

  const fetchedMemos = showMemoFilter
    ? memos.filter((memo) => {
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

        if (textQuery && !memo.content.toLowerCase().includes(textQuery.toLowerCase())) {
          shouldShow = false;
        }

        return shouldShow;
      })
    : memos;

  const sortedMemos = fetchedMemos
    .filter((m) => m.rowStatus === "NORMAL" && m.visibility !== "PRIVATE" && !m.parent)
    .sort((mi, mj) => mj.displayTs - mi.displayTs);

  useEffect(() => {
    memoStore.setLoadingStatus("incomplete");
  }, []);

  useEffect(() => {
    if (!fetchMoreRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      handleFetchMoreClick();
    });
    observer.observe(fetchMoreRef.current);

    return () => observer.disconnect();
  }, [loadingStatus]);

  const handleFetchMoreClick = async () => {
    try {
      await memoStore.fetchAllMemos(DEFAULT_MEMO_LIMIT, memos.length);
    } catch (error: any) {
      toast.error(error.response.data.message);
    }
  };

  return (
    <section className="@container w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader />
      <div className="relative w-full h-auto flex flex-col justify-start items-start">
        <MemoFilter />
        {sortedMemos.map((memo) => (
          <Memo key={memo.id} memo={memo} lazyRendering />
        ))}

        {loadingStatus === "fetching" ? (
          <div className="flex flex-col justify-start items-center w-full mt-2 mb-1">
            <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
          </div>
        ) : (
          <div className="flex flex-col justify-start items-center w-full my-6">
            <div className="text-sm text-gray-400 italic">
              {loadingStatus === "complete" ? (
                sortedMemos.length === 0 && (
                  <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                )
              ) : (
                <span ref={fetchMoreRef} className="cursor-pointer hover:text-green-600" onClick={handleFetchMoreClick}>
                  {t("memo.fetch-more")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Explore;
