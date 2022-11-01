import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "dayjs/locale/zh";
import { UNKNOWN_ID } from "../helpers/consts";
import { editorStateService, locationService, memoService, userService } from "../services";
import Icon from "./Icon";
import toastHelper from "./Toast";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import showMemoCardDialog from "./MemoCardDialog";
import showShareMemoImageDialog from "./ShareMemoImageDialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import "../less/memo.less";

dayjs.extend(relativeTime);

interface Props {
  memo: Memo;
}

export const getFormatedMemoTimeStr = (time: number, locale = "en"): string => {
  if (Date.now() - time < 1000 * 60 * 60 * 24) {
    return dayjs(time).locale(locale).fromNow();
  } else {
    return dayjs(time).locale(locale).format("YYYY/MM/DD HH:mm:ss");
  }
};

const Memo: React.FC<Props> = (props: Props) => {
  const memo = props.memo;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [displayTimeStr, setDisplayTimeStr] = useState<string>(getFormatedMemoTimeStr(memo.displayTs, i18n.language));
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const isVisitorMode = userService.isVisitorMode();

  useEffect(() => {
    let intervalFlag: any = -1;
    if (Date.now() - memo.displayTs < 1000 * 60 * 60 * 24) {
      intervalFlag = setInterval(() => {
        setDisplayTimeStr(getFormatedMemoTimeStr(memo.displayTs, i18n.language));
      }, 1000 * 1);
    }

    return () => {
      clearInterval(intervalFlag);
    };
  }, [i18n.language]);

  const handleShowMemoStoryDialog = () => {
    if (isVisitorMode) {
      return;
    }

    showMemoCardDialog(memo);
  };

  const handleViewMemoDetailPage = () => {
    navigate(`/m/${memo.id}`);
  };

  const handleCopyContent = () => {
    copy(memo.content);
    toastHelper.success(t("message.succeed-copy-content"));
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
      const memoTemp = await memoService.getMemoById(Number(memoId) ?? UNKNOWN_ID);

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
      const todoElementList = [...(memoContainerRef.current?.querySelectorAll(`span.todo-block[data-value=${status}]`) ?? [])];
      for (const element of todoElementList) {
        if (element === targetEl) {
          const index = todoElementList.indexOf(element);
          const tempList = memo.content.split(status === "DONE" ? /- \[x\] / : /- \[ \] /);
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
    } else if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        showPreviewImageDialog(imgUrl);
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
      {memo.pinned && <div className="corner-container"></div>}
      <div className="memo-top-wrapper">
        <div className="status-text-container">
          <span className="time-text" onClick={handleShowMemoStoryDialog}>
            {displayTimeStr}
          </span>
          {memo.visibility !== "PRIVATE" && !isVisitorMode && (
            <span className={`status-text ${memo.visibility.toLocaleLowerCase()}`}>{memo.visibility}</span>
          )}
        </div>
        {!isVisitorMode && (
          <div className="btns-container">
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
                <span className="btn" onClick={handleCopyContent}>
                  {t("memo.copy")}
                </span>
                <span className="btn" onClick={handleViewMemoDetailPage}>
                  {t("memo.view-detail")}
                </span>
                <span className="btn archive-btn" onClick={handleArchiveMemoClick}>
                  {t("common.archive")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <MemoContent
        content={memo.content}
        onMemoContentClick={handleMemoContentClick}
        onMemoContentDoubleClick={handleMemoContentDoubleClick}
      />
      <MemoResources memo={memo} />
    </div>
  );
};

export default memo(Memo);
