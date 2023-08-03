import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import { LINK_REG, PLAIN_LINK_REG, TAG_REG } from "@/labs/marked/parser";
import { useFilterStore, useMemoStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Empty from "./Empty";
import Memo from "./Memo";
import "@/less/memo-list.less";

interface Props {
  showCreator?: boolean;
}

const MemoList: React.FC<Props> = (props: Props) => {
  const { showCreator } = props;
  const t = useTranslate();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { memos, isFetching } = memoStore.state;
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const currentUsername = userStore.getCurrentUsername();
  const { tag: tagQuery, duration, type: memoType, text: textQuery, visibility } = filter;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || visibility);

  const shownMemos = (
    showMemoFilter
      ? memos.filter((memo) => {
          let shouldShow = true;

          if (tagQuery) {
            const tagsSet = new Set<string>();
            for (const t of Array.from(memo.content.match(new RegExp(TAG_REG, "gu")) ?? [])) {
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
          if (
            duration &&
            duration.from < duration.to &&
            (getTimeStampByDate(memo.displayTs) < duration.from || getTimeStampByDate(memo.displayTs) > duration.to)
          ) {
            shouldShow = false;
          }
          if (memoType) {
            if (memoType === "NOT_TAGGED" && memo.content.match(TAG_REG) !== null) {
              shouldShow = false;
            } else if (memoType === "LINKED" && (memo.content.match(LINK_REG) === null || memo.content.match(PLAIN_LINK_REG) === null)) {
              shouldShow = false;
            }
          }
          if (textQuery && !memo.content.toLowerCase().includes(textQuery.toLowerCase())) {
            shouldShow = false;
          }
          if (visibility) {
            shouldShow = memo.visibility === visibility;
          }

          return shouldShow;
        })
      : memos
  ).filter((memo) => memo.creatorUsername === currentUsername && memo.rowStatus === "NORMAL");

  const pinnedMemos = shownMemos.filter((m) => m.pinned);
  const unpinnedMemos = shownMemos.filter((m) => !m.pinned);
  const memoSort = (mi: Memo, mj: Memo) => {
    return mj.displayTs - mi.displayTs;
  };
  pinnedMemos.sort(memoSort);
  unpinnedMemos.sort(memoSort);
  const sortedMemos = pinnedMemos.concat(unpinnedMemos).filter((m) => m.rowStatus === "NORMAL");

  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    memoStore
      .fetchMemos()
      .then((fetchedMemos) => {
        if (fetchedMemos.length < DEFAULT_MEMO_LIMIT) {
          setIsComplete(true);
        } else {
          setIsComplete(false);
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      });
  }, [currentUsername]);

  useEffect(() => {
    const pageWrapper = document.body.querySelector(".page-wrapper");
    if (pageWrapper) {
      pageWrapper.scrollTo(0, 0);
    }
  }, [filter]);

  useEffect(() => {
    if (isFetching || isComplete) {
      return;
    }
    if (sortedMemos.length < DEFAULT_MEMO_LIMIT) {
      handleFetchMoreClick();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        handleFetchMoreClick();
        observer.unobserve(entry.target);
      }
    });
    if (statusRef?.current) {
      observer.observe(statusRef.current);
    }
    return () => {
      if (statusRef?.current) {
        observer.unobserve(statusRef.current);
      }
    };
  }, [isFetching, isComplete, filter, sortedMemos.length, statusRef]);

  const handleFetchMoreClick = async () => {
    try {
      const fetchedMemos = await memoStore.fetchMemos(DEFAULT_MEMO_LIMIT, memos.length);
      if (fetchedMemos.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  return (
    <div className="memo-list-container">
      {sortedMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.displayTs}`} memo={memo} showVisibility showCreator={showCreator} />
      ))}
      {isFetching ? (
        <div className="status-text-container fetching-tip">
          <p className="status-text">{t("memo.fetching-data")}</p>
        </div>
      ) : (
        <div ref={statusRef} className="status-text-container">
          <p className="status-text">
            {isComplete ? (
              sortedMemos.length === 0 && (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              )
            ) : (
              <>
                <span className="cursor-pointer hover:text-green-600" onClick={handleFetchMoreClick}>
                  {t("memo.fetch-more")}
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default MemoList;
