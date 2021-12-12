import { useCallback, useContext, useEffect, useRef, useState } from "react";
import appContext from "../stores/appContext";
import { locationService, memoService, queryService } from "../services";
import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { checkShouldShowMemoWithFilters } from "../helpers/filter";
import Memo from "./Memo";
import toastHelper from "./Toast";
import "../less/memolist.less";

interface Props {}

const MemoList: React.FC<Props> = () => {
  const {
    locationState: { query },
    memoState: { memos },
    globalState,
  } = useContext(appContext);
  const [isFetching, setFetchStatus] = useState(true);
  const wrapperElement = useRef<HTMLDivElement>(null);

  const { tag: tagQuery, duration, type: memoType, text: textQuery, filter: queryId } = query;
  const showMemoFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery);

  const shownMemos =
    showMemoFilter || queryId
      ? memos.filter((memo) => {
          let shouldShow = true;

          const query = queryService.getQueryById(queryId);
          if (query) {
            const filters = JSON.parse(query.querystring) as Filter[];
            if (Array.isArray(filters)) {
              shouldShow = checkShouldShowMemoWithFilters(memo, filters);
            }
          }

          if (tagQuery && !memo.content.includes(`# ${tagQuery}`)) {
            shouldShow = false;
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
      })
      .catch(() => {
        toastHelper.error("😭 请求数据失败了");
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
    <div className={`memolist-wrapper ${isFetching ? "" : "completed"}`} onClick={handleMemoListClick} ref={wrapperElement}>
      {shownMemos.map((memo) => (
        <Memo key={`${memo.id}-${memo.updatedAt}`} memo={memo} />
      ))}
      <div className="status-text-container">
        <p className="status-text">
          {isFetching ? "努力请求数据中..." : shownMemos.length === 0 ? "空空如也" : showMemoFilter ? "" : "所有数据加载完啦 🎉"}
        </p>
      </div>
    </div>
  );
};

export default MemoList;
