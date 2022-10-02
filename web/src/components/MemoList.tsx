import { useEffect, useRef } from "react";
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
  const { memos, isFetching } = useAppSelector((state) => state.memo);
  const wrapperElement = useRef<HTMLDivElement>(null);

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
            for (const t of Array.from(memo.content.match(TAG_REG) ?? [])) {
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
  }, []);

  useEffect(() => {
    wrapperElement.current?.scrollTo({
      top: 0,
    });
  }, [query]);

  return (
    <div className={`memo-list-container ${isFetching ? "" : "completed"}`} ref={wrapperElement}>
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
