import { memo, useEffect, useRef, useState } from "react";
import { escape, indexOf } from "lodash-es";
import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG, UNKNOWN_ID } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { DONE_BLOCK_REG, parseMarkedToHtml, TODO_BLOCK_REG } from "../helpers/marked";
import { editorStateService, locationService, memoService, userService } from "../services";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import Image from "./Image";
import showMemoCardDialog from "./MemoCardDialog";
import showShareMemoImageDialog from "./ShareMemoImageDialog";
import "../less/memo.less";

const MAX_MEMO_CONTAINER_HEIGHT = 384;

interface Props {
  memo: Memo;
}

type ExpandButtonStatus = -1 | 0 | 1;

interface State {
  expandButtonStatus: ExpandButtonStatus;
}

const Memo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo } = props;
  const memo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
  };
  const [state, setState] = useState<State>({
    expandButtonStatus: -1,
  });
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  useEffect(() => {
    if (!memoContainerRef) {
      return;
    }

    if (Number(memoContainerRef.current?.clientHeight) > MAX_MEMO_CONTAINER_HEIGHT) {
      setState({
        ...state,
        expandButtonStatus: 0,
      });
    }
  }, []);

  const handleShowMemoStoryDialog = () => {
    showMemoCardDialog(memo);
  };

  const handleTogglePinMemoBtnClick = async () => {
    try {
      if (memo.pinned) {
        await memoService.unpinMemo(memo.id);
      } else {
        await memoService.pinMemo(memo.id);
      }
    } catch (error) {
      // do nth
    }
  };

  const handleMarkMemoClick = () => {
    editorStateService.setMarkMemoWithId(memo.id);
  };

  const handleEditMemoClick = () => {
    editorStateService.setEditMemoWithId(memo.id);
  };

  const handleArchiveMemoClick = async () => {
    try {
      await memoService.patchMemo({
        id: memo.id,
        rowStatus: "ARCHIVED",
      });
    } catch (error: any) {
      toastHelper.error(error.message);
    }

    if (editorStateService.getState().editMemoId === memo.id) {
      editorStateService.clearEditMemo();
    }
  };

  const handleGenMemoImageBtnClick = () => {
    showShareMemoImageDialog(memo);
  };

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.className === "memo-link-text") {
      const memoId = targetEl.dataset?.value;
      const memoTemp = memoService.getMemoById(Number(memoId) ?? UNKNOWN_ID);

      if (memoTemp) {
        showMemoCardDialog(memoTemp);
      } else {
        toastHelper.error("MEMO Not Found");
        targetEl.classList.remove("memo-link-text");
      }
    } else if (targetEl.className === "tag-span") {
      const tagName = targetEl.innerText.slice(1);
      const currTagQuery = locationService.getState().query?.tag;
      if (currTagQuery === tagName) {
        locationService.setTagQuery(undefined);
      } else {
        locationService.setTagQuery(tagName);
      }
    } else if (targetEl.classList.contains("todo-block") && userService.isNotVisitor()) {
      const status = targetEl.dataset?.value;
      const todoElementList = [...(memoContainerRef.current?.querySelectorAll(`span.todo-block[data-value=${status}]`) ?? [])];
      for (const element of todoElementList) {
        if (element === targetEl) {
          const index = indexOf(todoElementList, element);
          const tempList = memo.content.split(status === "DONE" ? DONE_BLOCK_REG : TODO_BLOCK_REG);
          let finalContent = "";

          for (let i = 0; i < tempList.length; i++) {
            if (i === 0) {
              finalContent += `${tempList[i]}`;
            } else {
              if (i === index + 1) {
                finalContent += status === "DONE" ? "- [ ] " : "- [x] ";
              } else {
                finalContent += status === "DONE" ? "- [x] " : "- [ ] ";
              }
              finalContent += `${tempList[i]}`;
            }
          }
          await memoService.patchMemo({
            id: memo.id,
            content: finalContent,
          });
        }
      }
    }
  };

  const handleShowMoreBtnClick = () => {
    setState({
      ...state,
      expandButtonStatus: Number(Boolean(!state.expandButtonStatus)) as ExpandButtonStatus,
    });
  };

  return (
    <div className={`memo-wrapper ${"memos-" + memo.id} ${memo.pinned ? "pinned" : ""}`}>
      <div className="memo-top-wrapper">
        <span className="time-text" onClick={handleShowMemoStoryDialog}>
          {memo.createdAtStr}
          <Only when={memo.pinned}>
            <span className="ml-2">PINNED</span>
          </Only>
        </span>
        {userService.isNotVisitor() && (
          <div className="btns-container">
            <span className="btn more-action-btn">
              <img className="icon-img" src="/icons/more.svg" />
            </span>
            <div className="more-action-btns-wrapper">
              <div className="more-action-btns-container">
                <div className="btns-container">
                  <div className="btn" onClick={handleTogglePinMemoBtnClick}>
                    <img className="icon-img" src="/icons/pin.svg" alt="" />
                    <span className="tip-text">{memo.pinned ? "Unpin" : "Pin"}</span>
                  </div>
                  <div className="btn" onClick={handleEditMemoClick}>
                    <img className="icon-img" src="/icons/edit.svg" alt="" />
                    <span className="tip-text">Edit</span>
                  </div>
                  <div className="btn" onClick={handleGenMemoImageBtnClick}>
                    <img className="icon-img" src="/icons/share.svg" alt="" />
                    <span className="tip-text">Share</span>
                  </div>
                </div>
                <span className="btn" onClick={handleMarkMemoClick}>
                  Mark
                </span>
                <span className="btn" onClick={handleShowMemoStoryDialog}>
                  View Story
                </span>
                <span className="btn archive-btn" onClick={handleArchiveMemoClick}>
                  Archive
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        ref={memoContainerRef}
        className={`memo-content-text ${state.expandButtonStatus === 0 ? "expanded" : ""}`}
        onClick={handleMemoContentClick}
        dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}
      ></div>
      {state.expandButtonStatus !== -1 && (
        <div className="expand-btn-container">
          <span className={`btn ${state.expandButtonStatus === 0 ? "expand-btn" : "fold-btn"}`} onClick={handleShowMoreBtnClick}>
            {state.expandButtonStatus === 0 ? "Expand" : "Fold"}
            <img className="icon-img" src="/icons/arrow-right.svg" alt="" />
          </span>
        </div>
      )}
      <Only when={imageUrls.length > 0}>
        <div className="images-wrapper">
          {imageUrls.map((imgUrl, idx) => (
            <Image className="memo-img" key={idx} imgUrl={imgUrl} />
          ))}
        </div>
      </Only>
    </div>
  );
};

export function formatMemoContent(content: string) {
  const tempElement = document.createElement("div");
  tempElement.innerHTML = parseMarkedToHtml(escape(content));

  return tempElement.innerHTML
    .replace(IMAGE_URL_REG, "")
    .replace(TAG_REG, "<span class='tag-span'>#$1</span> ")
    .replace(LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$1'>$1</a>")
    .replace(MEMO_LINK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>");
}

export default memo(Memo);
