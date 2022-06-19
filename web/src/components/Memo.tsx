import { memo } from "react";
import { escape } from "lodash-es";
import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG, UNKNOWN_ID } from "../helpers/consts";
import { parseMarkedToHtml, parseRawTextToHtml } from "../helpers/marked";
import * as utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import { editorStateService, memoService } from "../services";
import Only from "./common/OnlyWhen";
import Image from "./Image";
import showMemoCardDialog from "./MemoCardDialog";
import showShareMemoImageDialog from "./ShareMemoImageDialog";
import toastHelper from "./Toast";
import "../less/memo.less";

interface Props {
  memo: Memo;
}

const Memo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo } = props;
  const memo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
  };
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);

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

  const handleDeleteMemoClick = async () => {
    if (showConfirmDeleteBtn) {
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
    } else {
      toggleConfirmDeleteBtn();
    }
  };

  const handleMouseLeaveMemoWrapper = () => {
    if (showConfirmDeleteBtn) {
      toggleConfirmDeleteBtn(false);
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
    } else if (targetEl.className === "todo-block") {
      // do nth
    }
  };

  return (
    <div className={`memo-wrapper ${"memos-" + memo.id} ${memo.pinned ? "pinned" : ""}`} onMouseLeave={handleMouseLeaveMemoWrapper}>
      <div className="memo-top-wrapper">
        <span className="time-text" onClick={handleShowMemoStoryDialog}>
          {memo.createdAtStr}
          <Only when={memo.pinned}>
            <span className="ml-2">PINNED</span>
          </Only>
        </span>
        <div className="btns-container">
          <span className="btn more-action-btn">
            <img className="icon-img" src="/icons/more.svg" />
          </span>
          <div className="more-action-btns-wrapper">
            <div className="more-action-btns-container">
              <span className="btn" onClick={handleShowMemoStoryDialog}>
                View Story
              </span>
              <span className="btn" onClick={handleTogglePinMemoBtnClick}>
                {memo.pinned ? "Unpin" : "Pin"}
              </span>
              <span className="btn" onClick={handleMarkMemoClick}>
                Mark
              </span>
              <span className="btn" onClick={handleGenMemoImageBtnClick}>
                Share
              </span>
              <span className="btn" onClick={handleEditMemoClick}>
                Edit
              </span>
              <span className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`} onClick={handleDeleteMemoClick}>
                {showConfirmDeleteBtn ? "Delete!" : "Delete"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        className="memo-content-text"
        onClick={handleMemoContentClick}
        dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}
      ></div>
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
  content = escape(content);
  content = parseRawTextToHtml(content)
    .split("<br>")
    .map((t) => {
      return `<p>${t !== "" ? t : "<br>"}</p>`;
    })
    .join("");

  content = parseMarkedToHtml(content);

  // Add space in english and chinese
  content = content.replace(/([\u4e00-\u9fa5])([A-Za-z0-9?.,;[\]]+)/g, "$1 $2").replace(/([A-Za-z0-9?.,;[\]]+)([\u4e00-\u9fa5])/g, "$1 $2");

  const tempDivContainer = document.createElement("div");
  tempDivContainer.innerHTML = content;
  for (let i = 0; i < tempDivContainer.children.length; i++) {
    const c = tempDivContainer.children[i];

    if (c.tagName === "P" && c.textContent === "" && c.firstElementChild?.tagName !== "BR") {
      c.remove();
      i--;
      continue;
    }
  }

  return tempDivContainer.innerHTML
    .replace(IMAGE_URL_REG, "")
    .replace(TAG_REG, "<span class='tag-span'>#$1</span> ")
    .replace(LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$1'>$1</a>")
    .replace(MEMO_LINK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>");
}

export default memo(Memo);
