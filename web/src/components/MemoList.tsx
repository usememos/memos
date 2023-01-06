import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocationStore, useMemoStore, useShortcutStore, useUserStore } from "../store/module";
import { TAG_REG, LINK_REG } from "../labs/marked/parser";
import * as utils from "../helpers/utils";
import { DEFAULT_MEMO_LIMIT } from "../helpers/consts";
import { checkShouldShowMemoWithFilters } from "../helpers/filter";
import toastHelper from "./Toast";
import Memo from "./Memo";
import "../less/memo-list.less";

const MemoList = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const shortcutStore = useShortcutStore();
  const locationStore = useLocationStore();
  const query = locationStore.state.query;
  const memoDisplayTsOption = userStore.state.user?.setting.memoDisplayTsOption;
  const { memos, isFetching } = memoStore.state;
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId, visibility } = query ?? {};
  const shortcut = shortcutId ? shortcutStore.getShortcutById(shortcutId) : null;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut || visibility);

  const shownMemos =
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
            (utils.getTimeStampByDate(memo.displayTs) < duration.from || utils.getTimeStampByDate(memo.displayTs) > duration.to)
          ) {
            shouldShow = false;
          }
          if (memoType) {
            if (memoType === "NOT_TAGGED" && memo.content.match(TAG_REG) !== null) {
              shouldShow = false;
            } else if (memoType === "LINKED" && memo.content.match(LINK_REG) === null) {
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
      : memos;

  const pinnedMemos = shownMemos.filter((m) => m.pinned);
  const unpinnedMemos = shownMemos.filter((m) => !m.pinned);
  const memoSort = (mi: Memo, mj: Memo) => {
    return mj.displayTs - mi.displayTs;
  };
  pinnedMemos.sort(memoSort);
  unpinnedMemos.sort(memoSort);
  const sortedMemos = pinnedMemos.concat(unpinnedMemos).filter((m) => m.rowStatus === "NORMAL");

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
        toastHelper.error(error.response.data.message);
      });
  }, [memoDisplayTsOption]);

  useEffect(() => {
    const pageWrapper = document.body.querySelector(".page-wrapper");
    if (pageWrapper) {
      pageWrapper.scrollTo(0, 0);
    }
  }, [query]);

  useEffect(() => {
    if (isFetching || isComplete) {
      return;
    }
    if (sortedMemos.length < DEFAULT_MEMO_LIMIT) {
      handleFetchMoreClick();
    }
  }, [isFetching, isComplete, query, sortedMemos.length]);

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
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <div className="memo-list-container">
      {sortedMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.displayTs}`} memo={memo} />
      ))}
      {isFetching ? (
        <div className="status-text-container fetching-tip">
          <p className="status-text">{t("memo-list.fetching-data")}</p>
        </div>
      ) : (
        <div className="status-text-container">
          <p className="status-text">
            {isComplete ? (
              sortedMemos.length === 0 ? (
                t("message.no-memos")
              ) : (
                t("message.memos-ready")
              )
            ) : (
              <>
                <span className="cursor-pointer hover:text-green-600" onClick={handleFetchMoreClick}>
                  {t("memo-list.fetch-more")}
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
