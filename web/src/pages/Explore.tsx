import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import MemoFilter from "@/components/MemoFilter";
import MemoViewV1 from "@/components/MemoViewV1";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilterStore } from "@/store/module";
import { useMemoV1Store } from "@/store/v1";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const filterStore = useFilterStore();
  const memoStore = useMemoV1Store();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { tag: tagQuery, text: textQuery } = filterStore.state;

  useEffect(() => {
    fetchMemos();
  }, [tagQuery, textQuery]);

  const fetchMemos = async () => {
    const filters = [`row_status == "NORMAL"`, `visibilities == [${user ? "'PUBLIC', 'PROTECTED'" : "'PUBLIC'"}]`];
    if (tagQuery) filters.push(`tags == "${tagQuery}"`);
    if (textQuery) filters.push(`content_search == "${textQuery}"`);
    setIsRequesting(true);
    const data = await memoStore.fetchMemos({
      limit: DEFAULT_MEMO_LIMIT,
      offset: memos.length,
      filter: filters.join(" && "),
    });
    setIsRequesting(false);
    setMemos([...memos, ...data]);
    setIsComplete(data.length < DEFAULT_MEMO_LIMIT);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="relative w-full h-auto flex flex-col justify-start items-start px-4 sm:px-6">
        <MemoFilter />
        {memos.map((memo) => (
          <MemoViewV1 key={memo.id} memo={memo} lazyRendering showCreator showParent />
        ))}

        {isRequesting && (
          <div className="flex flex-col justify-start items-center w-full my-8">
            <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
          </div>
        )}
        {isComplete ? (
          memos.length === 0 && (
            <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
            </div>
          )
        ) : (
          <div className="w-full flex flex-row justify-center items-center my-2">
            <span className="cursor-pointer text-sm italic text-gray-500  hover:text-green-600" onClick={fetchMemos}>
              {t("memo.fetch-more")}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default Explore;
