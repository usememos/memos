import { memo, useEffect, useRef, useState } from "react";
import { indexOf } from "lodash-es";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh";
import useI18n from "../hooks/useI18n";
import { IMAGE_URL_REG, UNKNOWN_ID } from "../helpers/consts";
import { DONE_BLOCK_REG, formatMemoContent, TODO_BLOCK_REG } from "../helpers/marked";
import { editorStateService, locationService, memoService, userService } from "../services";
import Icon from "./Icon";
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
  const [state, setState] = useState<State>({
    expandButtonStatus: -1,
  });
  const [createdAtStr, setCreatedAtStr] = useState<string>(getFormatedMemoCreatedAtStr(memo.createdTs, locale));
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
        setCreatedAtStr(getFormatedMemoCreatedAtStr(memo.createdTs, locale));
      }, 1000 * 1);
    }
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
                  <Icon.MapPin className={`icon-img ${memo.pinned ? "" : "opacity-20"}`} />
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
                View Story
              </span>
              <span className="btn archive-btn" onClick={handleArchiveMemoClick}>
                {t("common.archive")}
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
            <Icon.ChevronRight className="icon-img" />
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

export default memo(Memo);
