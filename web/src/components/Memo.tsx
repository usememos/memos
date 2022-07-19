import { memo, useEffect, useRef, useState } from "react";
import { escape, indexOf } from "lodash-es";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { IMAGE_URL_REG, LINK_URL_REG, MEMO_LINK_REG, TAG_REG, UNKNOWN_ID } from "../helpers/consts";
import { DONE_BLOCK_REG, parseMarkedToHtml, TODO_BLOCK_REG } from "../helpers/marked";
import { editorStateService, locationService, memoService, userService } from "../services";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import Image from "./Image";
import showMemoCardDialog from "./MemoCardDialog";
import showShareMemoImageDialog from "./ShareMemoImageDialog";
import "../less/memo.less";

dayjs.extend(relativeTime);

const MAX_MEMO_CONTAINER_HEIGHT = 384;

type ExpandButtonStatus = -1 | 0 | 1;

interface Props {
  memo: Memo;
}

interface State {
  expandButtonStatus: ExpandButtonStatus;
}

export const getFormatedMemoCreatedAtStr = (createdTs: number): string => {
  if (Date.now() - createdTs < 1000 * 60 * 60 * 24) {
    return dayjs(createdTs).fromNow();
  } else {
    return dayjs(createdTs).format("YYYY/MM/DD HH:mm:ss");
  }
};

const Memo: React.FC<Props> = (props: Props) => {
  const memo = props.memo;
  const [state, setState] = useState<State>({
    expandButtonStatus: -1,
  });
  const [createdAtStr, setCreatedAtStr] = useState<string>(getFormatedMemoCreatedAtStr(memo.createdTs));
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));
  const isVisitorMode = userService.isVisitorMode();

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

    if (Date.now() - memo.createdTs < 1000 * 60 * 60 * 24) {
      setInterval(() => {
        setCreatedAtStr(dayjs(memo.createdTs).fromNow());
      }, 1000 * 1);
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
    } else if (targetEl.classList.contains("todo-block")) {
      if (userService.isVisitorMode()) {
        return;
      }

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

  const handleExpandBtnClick = () => {
    setState({
      expandButtonStatus: Number(Boolean(!state.expandButtonStatus)) as ExpandButtonStatus,
    });
  };

  return (
    <div className={`memo-wrapper ${"memos-" + memo.id} ${memo.pinned ? "pinned" : ""}`}>
      <div className="memo-top-wrapper">
        <div className="status-text-container" onClick={handleShowMemoStoryDialog}>
          <span className="time-text">{createdAtStr}</span>
          <Only when={memo.pinned}>
            <span className="status-text">PINNED</span>
          </Only>
          <Only when={memo.visibility === "PUBLIC" && !isVisitorMode}>
            <span className="status-text">PUBLIC</span>
          </Only>
        </div>
        <div className={`btns-container ${userService.isVisitorMode() ? "!hidden" : ""}`}>
          <span className="btn more-action-btn">
            <i className="fa-solid fa-ellipsis icon-img"></i>
          </span>
          <div className="more-action-btns-wrapper">
            <div className="more-action-btns-container">
              <div className="btns-container">
                <div className="btn" onClick={handleTogglePinMemoBtnClick}>
                  <i className={`fa-solid fa-thumbtack icon-img ${memo.pinned ? "" : "opacity-20"}`}></i>
                  <span className="tip-text">{memo.pinned ? "Unpin" : "Pin"}</span>
                </div>
                <div className="btn" onClick={handleEditMemoClick}>
                  <i className="fa-solid fa-pen-to-square icon-img"></i>
                  <span className="tip-text">Edit</span>
                </div>
                <div className="btn" onClick={handleGenMemoImageBtnClick}>
                  <i className="fa-solid fa-share-nodes icon-img"></i>
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
      </div>
      <div
        ref={memoContainerRef}
        className={`memo-content-text ${state.expandButtonStatus === 0 ? "expanded" : ""}`}
        onClick={handleMemoContentClick}
        dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}
      ></div>
      {state.expandButtonStatus !== -1 && (
        <div className="expand-btn-container">
          <span className={`btn ${state.expandButtonStatus === 0 ? "expand-btn" : "fold-btn"}`} onClick={handleExpandBtnClick}>
            {state.expandButtonStatus === 0 ? "Expand" : "Fold"}
            <i className="fa-solid fa-chevron-right icon-img"></i>
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
    .replace(MEMO_LINK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>")
    .replace(LINK_URL_REG, "<a class='link' target='_blank' rel='noreferrer' href='$2'>$1</a>")
    .replace(TAG_REG, "<span class='tag-span'>#$1</span> ");
}

export default memo(Memo);
