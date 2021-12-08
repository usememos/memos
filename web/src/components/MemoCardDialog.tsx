import { useState, useEffect, useCallback } from "react";
import { IMAGE_URL_REG, MEMO_LINK_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { globalStateService, memoService } from "../services";
import { parseHtmlToRawText } from "../helpers/marked";
import { formatMemoContent } from "./Memo";
import toastHelper from "./Toast";
import { showDialog } from "./Dialog";
import Only from "./common/OnlyWhen";
import Image from "./Image";
import "../less/memo-card-dialog.less";

interface LinkedMemo extends FormattedMemo {
  dateStr: string;
}

interface Props extends DialogProps {
  memo: Model.Memo;
}

const MemoCardDialog: React.FC<Props> = (props: Props) => {
  const [memo, setMemo] = useState<FormattedMemo>({
    ...props.memo,
    createdAtStr: utils.getDateTimeString(props.memo.createdAt),
  });
  const [linkMemos, setLinkMemos] = useState<LinkedMemo[]>([]);
  const [linkedMemos, setLinkedMemos] = useState<LinkedMemo[]>([]);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);

  useEffect(() => {
    const fetchLinkedMemos = async () => {
      try {
        const linkMemos: LinkedMemo[] = [];
        const matchedArr = [...memo.content.matchAll(MEMO_LINK_REG)];
        for (const matchRes of matchedArr) {
          if (matchRes && matchRes.length === 3) {
            const id = matchRes[2];
            const memoTemp = memoService.getMemoById(id);
            if (memoTemp) {
              linkMemos.push({
                ...memoTemp,
                createdAtStr: utils.getDateTimeString(memoTemp.createdAt),
                dateStr: utils.getDateString(memoTemp.createdAt),
              });
            }
          }
        }
        setLinkMemos([...linkMemos]);

        const linkedMemos = await memoService.getLinkedMemos(memo.id);
        setLinkedMemos(
          linkedMemos
            .sort((a, b) => utils.getTimeStampByDate(b.createdAt) - utils.getTimeStampByDate(a.createdAt))
            .map((m) => ({
              ...m,
              createdAtStr: utils.getDateTimeString(m.createdAt),
              dateStr: utils.getDateString(m.createdAt),
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
      const memoTemp = memoService.getMemoById(nextMemoId ?? "");

      if (memoTemp) {
        const nextMemo = {
          ...memoTemp,
          createdAtStr: utils.getDateTimeString(memoTemp.createdAt),
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

  const handleLinkedMemoClick = useCallback((memo: FormattedMemo) => {
    setLinkMemos([]);
    setLinkedMemos([]);
    setMemo(memo);
  }, []);

  const handleEditMemoBtnClick = useCallback(() => {
    props.destroy();
    globalStateService.setEditMemoId(memo.id);
  }, [memo.id]);

  return (
    <>
      <div className="memo-card-container">
        <div className="header-container">
          <p className="time-text">{memo.createdAtStr}</p>
          <div className="btns-container">
            <button className="btn edit-btn" onClick={handleEditMemoBtnClick}>
              <img className="icon-img" src="/icons/edit.svg" />
            </button>
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
          <p className="normal-text">关联了 {linkMemos.length} 个 MEMO</p>
          {linkMemos.map((m) => {
            const rawtext = parseHtmlToRawText(formatMemoContent(m.content)).replaceAll("\n", " ");
            return (
              <div className="linked-memo-container" key={m.id} onClick={() => handleLinkedMemoClick(m)}>
                <span className="time-text">{m.dateStr} </span>
                {rawtext}
              </div>
            );
          })}
        </div>
      ) : null}
      {linkedMemos.length > 0 ? (
        <div className="linked-memos-wrapper">
          <p className="normal-text">{linkedMemos.length} 个链接至此的 MEMO</p>
          {linkedMemos.map((m) => {
            const rawtext = parseHtmlToRawText(formatMemoContent(m.content)).replaceAll("\n", " ");
            return (
              <div className="linked-memo-container" key={m.id} onClick={() => handleLinkedMemoClick(m)}>
                <span className="time-text">{m.dateStr} </span>
                {rawtext}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

export default function showMemoCardDialog(memo: Model.Memo): void {
  showDialog(
    {
      className: "memo-card-dialog",
    },
    MemoCardDialog,
    { memo }
  );
}
