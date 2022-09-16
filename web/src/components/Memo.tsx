import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { indexOf } from "lodash-es";
import { memo, useEffect, useRef, useState } from "react";
import "dayjs/locale/zh";
import useI18n from "../hooks/useI18n";
import { UNKNOWN_ID } from "../helpers/consts";
import { DONE_BLOCK_REG, TODO_BLOCK_REG } from "../helpers/marked";
import { editorStateService, locationService, memoService, userService } from "../services";
import Icon from "./Icon";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import showMemoCardDialog from "./MemoCardDialog";
import showShareMemoImageDialog from "./ShareMemoImageDialog";
import "../less/memo.less";

dayjs.extend(relativeTime);

interface Props {
  memo: Memo;
}

export const getFormatedMemoCreatedAtStr = (createdTs: number, locale = "en"): string => {
  if (Date.now() - createdTs < 1000 * 60 * 60 * 24) {
    return dayjs(createdTs).locale(locale).fromNow();
  } else {
    return dayjs(createdTs).locale(locale).format("YYYY/MM/DD HH:mm:ss");
  }
};

const Memo: React.FC<Props> = (props: Props) => {
  const memo = props.memo;
  const { t, locale } = useI18n();
  const [createdAtStr, setCreatedAtStr] = useState<string>(getFormatedMemoCreatedAtStr(memo.createdTs, locale));
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const isVisitorMode = userService.isVisitorMode();

  useEffect(() => {
    let intervalFlag = -1;
    if (Date.now() - memo.createdTs < 1000 * 60 * 60 * 24) {
      intervalFlag = setInterval(() => {
        setCreatedAtStr(getFormatedMemoCreatedAtStr(memo.createdTs, locale));
      }, 1000 * 1);
    }

    return () => {
      clearInterval(intervalFlag);
    };
  }, [locale]);

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
      console.error(error);
      toastHelper.error(error.response.data.message);
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
        toastHelper.error(t("message.memo-not-found"));
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
      const todoElementList = [...(memoContentContainerRef.current?.querySelectorAll(`span.todo-block[data-value=${status}]`) ?? [])];
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

  const handleMemoContentDoubleClick = (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.className === "memo-link-text") {
      return;
    } else if (targetEl.className === "tag-span") {
      return;
    } else if (targetEl.classList.contains("todo-block")) {
      return;
    }

    editorStateService.setEditMemoWithId(memo.id);
  };

  return (
    <div className={`memo-wrapper ${"memos-" + memo.id} ${memo.pinned ? "pinned" : ""}`} ref={memoContainerRef}>
      <div className="memo-top-wrapper">
        <div className="status-text-container" onClick={handleShowMemoStoryDialog}>
          <span className="time-text">{createdAtStr}</span>
          <Only when={memo.visibility !== "PRIVATE" && !isVisitorMode}>
            <span className={`status-text ${memo.visibility.toLocaleLowerCase()}`}>{memo.visibility}</span>
          </Only>
        </div>
        <div className={`btns-container ${userService.isVisitorMode() ? "!hidden" : ""}`}>
          <span className="btn more-action-btn">
            <Icon.MoreHorizontal className="icon-img" />
          </span>
          <div className="more-action-btns-wrapper">
            <div className="more-action-btns-container">
              <div className="btns-container">
                <div className="btn" onClick={handleTogglePinMemoBtnClick}>
                  <Icon.Flag className={`icon-img ${memo.pinned ? "" : "opacity-20"}`} />
                  <span className="tip-text">{memo.pinned ? t("common.unpin") : t("common.pin")}</span>
                </div>
                <div className="btn" onClick={handleEditMemoClick}>
                  <Icon.Edit3 className="icon-img" />
                  <span className="tip-text">{t("common.edit")}</span>
                </div>
                <div className="btn" onClick={handleGenMemoImageBtnClick}>
                  <Icon.Share className="icon-img" />
                  <span className="tip-text">{t("common.share")}</span>
                </div>
              </div>
              <span className="btn" onClick={handleMarkMemoClick}>
                {t("common.mark")}
              </span>
              <span className="btn" onClick={handleShowMemoStoryDialog}>
                {t("memo.view-story")}
              </span>
              <span className="btn archive-btn" onClick={handleArchiveMemoClick}>
                {t("common.archive")}
              </span>
            </div>
          </div>
        </div>
      </div>
      <MemoContent
        className=""
        content={memo.content}
        onMemoContentClick={handleMemoContentClick}
        onMemoContentDoubleClick={handleMemoContentDoubleClick}
      />
      <MemoResources memo={memo} />
    </div>
  );
};

export default memo(Memo);
