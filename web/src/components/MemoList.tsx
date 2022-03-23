import { useCallback, useContext, useEffect, useRef, useState } from "react";
import appContext from "../stores/appContext";
import { locationService, memoService, shortcutService } from "../services";
import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { checkShouldShowMemoWithFilters } from "../helpers/filter";
import Memo from "./Memo";
import toastHelper from "./Toast";
import "../less/memo-list.less";

interface Props {}

const MemoList: React.FC<Props> = () => {
  const {
    locationState: { query },
    memoState: { memos },
  } = useContext(appContext);
  const [isFetching, setFetchStatus] = useState(true);
  const wrapperElement = useRef<HTMLDivElement>(null);

  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId } = query;
  const queryFilter = shortcutService.getShortcutById(shortcutId);
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || queryFilter);

  const shownMemos =
    showMemoFilter || queryFilter
      ? memos.filter((memo) => {
          let shouldShow = true;

          if (queryFilter) {
            const filters = JSON.parse(queryFilter.payload) as Filter[];
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
            (utils.getTimeStampByDate(memo.createdAt) < duration.from || utils.getTimeStampByDate(memo.createdAt) > duration.to)
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

  useEffect(() => {
    memoService
      .fetchAllMemos()
      .then(() => {
        setFetchStatus(false);
        memoService.updateTagsState();
      })
      .catch(() => {
        toastHelper.error("😭 Refresh failed, please try again later.");
      });
  }, []);

  useEffect(() => {
    wrapperElement.current?.scrollTo({ top: 0 });
  }, [query]);

  const handleMemoListClick = useCallback((event: React.MouseEvent) => {
    const targetEl = event.target as HTMLElement;
    if (targetEl.tagName === "SPAN" && targetEl.className === "tag-span") {
      const tagName = targetEl.innerText.slice(1);
      const currTagQuery = locationService.getState().query.tag;
      if (currTagQuery === tagName) {
        locationService.setTagQuery("");
      } else {
        locationService.setTagQuery(tagName);
      }
    }
  }, []);

  return (
    <div className={`memo-list-container ${isFetching ? "" : "completed"}`} onClick={handleMemoListClick} ref={wrapperElement}>
      {shownMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.updatedAt}`} memo={memo} />
      ))}
      <div className="status-text-container">
        <p className="status-text">
          {isFetching
            ? "Fetching data..."
            : shownMemos.length === 0
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
