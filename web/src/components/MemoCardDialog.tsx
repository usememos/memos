import { useState, useEffect, useCallback } from "react";
import { IMAGE_URL_REG, MEMO_LINK_REG, UNKNOWN_ID } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { editorStateService, memoService, userService } from "../services";
import { parseHtmlToRawText } from "../helpers/marked";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import { showDialog } from "./Dialog";
import Image from "./Image";
import { formatMemoContent } from "./Memo";
import "../less/memo-card-dialog.less";

interface LinkedMemo extends Memo {
  createdAtStr: string;
  dateStr: string;
}

interface Props extends DialogProps {
  memo: Memo;
}

const MemoCardDialog: React.FC<Props> = (props: Props) => {
  const [memo, setMemo] = useState<Memo>({
    ...props.memo,
  });
  const [linkMemos, setLinkMemos] = useState<LinkedMemo[]>([]);
  const [linkedMemos, setLinkedMemos] = useState<LinkedMemo[]>([]);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  useEffect(() => {
    const fetchLinkedMemos = async () => {
      try {
        const linkMemos: LinkedMemo[] = [];
        const matchedArr = [...memo.content.matchAll(MEMO_LINK_REG)];
        for (const matchRes of matchedArr) {
          if (matchRes && matchRes.length === 3) {
            const id = Number(matchRes[2]);
            if (id === memo.id) {
              continue;
            }

            const memoTemp = memoService.getMemoById(id);
            if (memoTemp) {
              linkMemos.push({
                ...memoTemp,
                createdAtStr: utils.getDateTimeString(memoTemp.createdTs),
                dateStr: utils.getDateString(memoTemp.createdTs),
              });
            }
          }
        }
        setLinkMemos([...linkMemos]);

        const linkedMemos = await memoService.getLinkedMemos(memo.id);
        setLinkedMemos(
          linkedMemos
            .filter((m) => m.rowStatus === "NORMAL" && m.id !== memo.id)
            .sort((a, b) => utils.getTimeStampByDate(b.createdTs) - utils.getTimeStampByDate(a.createdTs))
            .map((m) => ({
              ...m,
              createdAtStr: utils.getDateTimeString(m.createdTs),
              dateStr: utils.getDateString(m.createdTs),
            }))
        );
      } catch (error) {
        // do nth
      }
    };

    fetchLinkedMemos();
  }, [memo.id]);

  const handleMemoContentClick = useCallback(async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.className === "memo-link-text") {
      const nextMemoId = targetEl.dataset?.value;
      const memoTemp = memoService.getMemoById(Number(nextMemoId) ?? UNKNOWN_ID);

      if (memoTemp) {
        const nextMemo = {
          ...memoTemp,
          createdAtStr: utils.getDateTimeString(memoTemp.createdTs),
        };
        setLinkMemos([]);
        setLinkedMemos([]);
        setMemo(nextMemo);
      } else {
        toastHelper.error("MEMO Not Found");
        targetEl.classList.remove("memo-link-text");
      }
    }
  }, []);

  const handleLinkedMemoClick = useCallback((memo: Memo) => {
    setLinkMemos([]);
    setLinkedMemos([]);
    setMemo(memo);
  }, []);

  const handleEditMemoBtnClick = useCallback(() => {
    props.destroy();
    editorStateService.setEditMemoWithId(memo.id);
  }, [memo.id]);

  const handleVisibilityClick = async () => {
    const visibility = memo.visibility === "PRIVATE" ? "PUBLIC" : "PRIVATE";
    await memoService.patchMemo({
      id: memo.id,
      visibility: visibility,
    });
    setMemo({
      ...memo,
      visibility: visibility,
    });
  };

  return (
    <>
      <div className="memo-card-container">
        <div className="header-container">
          <p className="time-text">{utils.getDateTimeString(memo.createdTs)}</p>
          <div className="btns-container">
            <Only when={!userService.isVisitorMode()}>
              <>
                <button className="btn edit-btn" onClick={handleVisibilityClick}>
                  <img className={`icon-img ${memo.visibility === "PRIVATE" ? "opacity-30" : ""}`} src="/icons/visibility.svg" />
                </button>
                <button className="btn edit-btn" onClick={handleEditMemoBtnClick}>
                  <img className="icon-img" src="/icons/edit.svg" />
                </button>
              </>
            </Only>
            <button className="btn close-btn" onClick={props.destroy}>
              <img className="icon-img" src="/icons/close.svg" />
            </button>
          </div>
        </div>
        <div className="memo-container">
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
        <div className="layer-container"></div>
        {linkMemos.map((_, idx) => {
          if (idx < 4) {
            return (
              <div
                className="background-layer-container"
                key={idx}
                style={{
                  bottom: (idx + 1) * -3 + "px",
                  left: (idx + 1) * 5 + "px",
                  width: `calc(100% - ${(idx + 1) * 10}px)`,
                  zIndex: -idx - 1,
                }}
              ></div>
            );
          } else {
            return null;
          }
        })}
      </div>
      {linkMemos.length > 0 ? (
        <div className="linked-memos-wrapper">
          <p className="normal-text">{linkMemos.length} related MEMO</p>
          {linkMemos.map((memo, index) => {
            const rawtext = parseHtmlToRawText(formatMemoContent(memo.content)).replaceAll("\n", " ");
            return (
              <div className="linked-memo-container" key={`${index}-${memo.id}`} onClick={() => handleLinkedMemoClick(memo)}>
                <span className="time-text">{memo.dateStr} </span>
                {rawtext}
              </div>
            );
          })}
        </div>
      ) : null}
      {linkedMemos.length > 0 ? (
        <div className="linked-memos-wrapper">
          <p className="normal-text">{linkedMemos.length} linked MEMO</p>
          {linkedMemos.map((memo, index) => {
            const rawtext = parseHtmlToRawText(formatMemoContent(memo.content)).replaceAll("\n", " ");
            return (
              <div className="linked-memo-container" key={`${index}-${memo.id}`} onClick={() => handleLinkedMemoClick(memo)}>
                <span className="time-text">{memo.dateStr} </span>
                {rawtext}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

export default function showMemoCardDialog(memo: Memo): void {
  showDialog(
    {
      className: "memo-card-dialog",
    },
    MemoCardDialog,
    { memo }
  );
}
