import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import HomeSidebar from "@/components/HomeSidebar";
import HomeSidebarDrawer from "@/components/HomeSidebarDrawer";
import MemoEditorV1 from "@/components/MemoEditorV1";
import MemoFilter from "@/components/MemoFilter";
import MemoViewV1 from "@/components/MemoViewV1";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useFilterStore } from "@/store/module";
import { useMemoV1Store } from "@/store/v1";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
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
    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`];
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

  const handleMemoCreated = async (memoId: number) => {
    const memo = await memoStore.getOrFetchMemoById(memoId);
    setMemos([memo, ...memos]);
  };

  return (
    <div className="w-full max-w-5xl flex flex-row justify-center items-start">
      <div className="w-full sm:pt-3 md:pt-6">
        <MobileHeader>{!md && <HomeSidebarDrawer />}</MobileHeader>
        <div className="w-full px-4 sm:px-6 md:pr-2">
          <MemoEditorV1 className="mb-2" cacheKey="home-memo-editor" onConfirm={handleMemoCreated} />
          <div className="flex flex-col justify-start items-start w-full max-w-full overflow-y-scroll pb-28 hide-scrollbar">
            <MemoFilter />
            {memos.map((memo) => (
              <MemoViewV1 key={memo.id} memo={memo} lazyRendering showVisibility showPinnedStyle showParent />
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
        </div>
      </div>
      {md && (
        <div className="hidden md:block sticky top-0 left-0 shrink-0 w-56">
          <HomeSidebar />
        </div>
      )}
    </div>
  );
};

export default Home;
