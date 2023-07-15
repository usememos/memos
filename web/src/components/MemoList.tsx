import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { useFilterStore, useMemoStore, useShortcutStore, useUserStore } from "@/store/module";
import { TAG_REG, LINK_REG, PLAIN_LINK_REG } from "@/labs/marked/parser";
import { getTimeStampByDate } from "@/helpers/datetime";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { checkShouldShowMemoWithFilters } from "@/helpers/filter";
import Empty from "./Empty";
import Memo from "./Memo";
import "@/less/memo-list.less";

const MemoList = () => {
  const t = useTranslate();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const shortcutStore = useShortcutStore();
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { memos, isFetching } = memoStore.state;
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const currentUserId = userStore.getCurrentUserId();
  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId, visibility } = filter;
  const shortcut = shortcutId ? shortcutStore.getShortcutById(shortcutId) : null;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut || visibility);

  const shownMemos = (
    showMemoFilter || shortcut
      ? memos.filter((memo) => {
          let shouldShow = true;

          if (shortcut) {
            const filters = JSON.parse(shortcut.payload) as Filter[];
            if (Array.isArray(filters)) {
              shouldShow = checkShouldShowMemoWithFilters(memo, filters);
            }
          }
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
  ).filter((memo) => memo.creatorId === currentUserId && memo.rowStatus === "NORMAL");

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
  }, [currentUserId]);

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
        <Memo key={`${memo.id}-${memo.displayTs}`} memo={memo} showVisibility />
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
                <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
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
