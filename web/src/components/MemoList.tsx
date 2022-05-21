import { useCallback, useEffect, useRef, useState } from "react";
import { locationService, memoService, shortcutService } from "../services";
import { useAppSelector } from "../store";
import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { checkShouldShowMemoWithFilters } from "../helpers/filter";
import Memo from "./Memo";
import toastHelper from "./Toast";
import "../less/memo-list.less";

interface Props {}

const MemoList: React.FC<Props> = () => {
  const {
    location: { query },
    memo: { memos },
  } = useAppSelector((state) => state);
  const [isFetching, setFetchStatus] = useState(true);
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
            } else if (memoType === "IMAGED" && memo.content.match(IMAGE_URL_REG) === null) {
              shouldShow = false;
            } else if (memoType === "CONNECTED" && memo.content.match(MEMO_LINK_REG) === null) {
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
      .fetchAllMemos()
      .then(() => {
        setFetchStatus(false);
        memoService.updateTagsState();
      })
      .catch(() => {
        toastHelper.error("😭 Fetching failed, please try again later.");
      });
  }, []);

  useEffect(() => {
    wrapperElement.current?.scrollTo({ top: 0 });
  }, [query]);

  const handleMemoListClick = useCallback((event: React.MouseEvent) => {
    const targetEl = event.target as HTMLElement;
    if (targetEl.tagName === "SPAN" && targetEl.className === "tag-span") {
      const tagName = targetEl.innerText.slice(1);
      const currTagQuery = locationService.getState().query?.tag;
      if (currTagQuery === tagName) {
        locationService.setTagQuery("");
      } else {
        locationService.setTagQuery(tagName);
      }
    }
  }, []);

  return (
    <div className={`memo-list-container ${isFetching ? "" : "completed"}`} onClick={handleMemoListClick} ref={wrapperElement}>
      {sortedMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
      ))}
      <div className="status-text-container">
        <p className="status-text">
          {isFetching
            ? "Fetching data..."
            : sortedMemos.length === 0
            ? "Oops, there is nothing"
            : showMemoFilter
            ? ""
            : "Fetching completed 🎉"}
        </p>
      </div>
    </div>
  );
};

export default MemoList;
