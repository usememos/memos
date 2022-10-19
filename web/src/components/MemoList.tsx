import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { memoService, shortcutService } from "../services";
import { useAppSelector } from "../store";
import { TAG_REG, LINK_REG } from "../labs/marked/parser";
import * as utils from "../helpers/utils";
import { checkShouldShowMemoWithFilters } from "../helpers/filter";
import toastHelper from "./Toast";
import Memo from "./Memo";
import "../less/memo-list.less";

const MemoList = () => {
  const { t } = useTranslation();
  const query = useAppSelector((state) => state.location.query);
  const updatedTime = useAppSelector((state) => state.location.updatedTime);
  const user = useAppSelector((state) => state.user.user);
  const { memos, isFetching } = useAppSelector((state) => state.memo);

  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId } = query ?? {};
  const shortcut = shortcutId ? shortcutService.getShortcutById(shortcutId) : null;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut);

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
            (utils.getTimeStampByDate(memo.createdTs) < duration.from || utils.getTimeStampByDate(memo.createdTs) > duration.to)
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
          if (textQuery && !memo.content.includes(textQuery)) {
            shouldShow = false;
          }

          return shouldShow;
        })
      : memos;

  const pinnedMemos = shownMemos.filter((m) => m.pinned);
  const unpinnedMemos = shownMemos.filter((m) => !m.pinned);
  const memoSorting = (m1: Memo, m2: Memo) => {
    return user?.setting.memoSortOption === "created_ts" ? m2.createdTs - m1.createdTs : m2.updatedTs - m1.updatedTs;
  };
  pinnedMemos.sort(memoSorting);
  unpinnedMemos.sort(memoSorting);
  const sortedMemos = pinnedMemos.concat(unpinnedMemos).filter((m) => m.rowStatus === "NORMAL");

  useEffect(() => {
    memoService
      .fetchMemos()
      .then(() => {
        // do nth
      })
      .catch((error) => {
        console.error(error);
        toastHelper.error(error.response.data.message);
      });
  }, [updatedTime]);

  useEffect(() => {
    const pageWrapper = document.body.querySelector(".page-wrapper");
    if (pageWrapper) {
      pageWrapper.scrollTo(0, 0);
    }
  }, [query, updatedTime]);

  return (
    <div className="memo-list-container">
      {sortedMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.createdTs}-${memo.updatedTs}`} memo={memo} />
      ))}
      {isFetching ? (
        <div className="status-text-container fetching-tip">
          <p className="status-text">{t("memo-list.fetching-data")}</p>
        </div>
      ) : (
        <div className="status-text-container">
          <p className="status-text">{sortedMemos.length === 0 ? t("message.no-memos") : showMemoFilter ? "" : t("message.memos-ready")}</p>
        </div>
      )}
    </div>
  );
};

export default MemoList;
