import { useState, useEffect, useCallback } from "react";
import { editorStateService, memoService, userService } from "../services";
import { useAppSelector } from "../store";
import { UNKNOWN_ID, VISIBILITY_SELECTOR_ITEMS } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { formatMemoContent, MEMO_LINK_REG, parseHtmlToRawText } from "../helpers/marked";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import Selector from "./common/Selector";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import showChangeMemoCreatedTsDialog from "./ChangeMemoCreatedTsDialog";
import "../less/memo-card-dialog.less";

interface LinkedMemo extends Memo {
  createdAtStr: string;
  dateStr: string;
}

interface Props extends DialogProps {
  memo: Memo;
}

const MemoCardDialog: React.FC<Props> = (props: Props) => {
  const memos = useAppSelector((state) => state.memo.memos);
  const [memo, setMemo] = useState<Memo>({
    ...props.memo,
  });
  const [linkMemos, setLinkMemos] = useState<LinkedMemo[]>([]);
  const [linkedMemos, setLinkedMemos] = useState<LinkedMemo[]>([]);

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
    setMemo(memoService.getMemoById(memo.id) as Memo);
  }, [memos, memo.id]);

  const handleMemoCreatedAtClick = () => {
    showChangeMemoCreatedTsDialog(memo.id);
  };

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
        toastHelper.error("Memo Not Found");
        targetEl.classList.remove("memo-link-text");
      }
    }
  }, []);

  const handleLinkedMemoClick = useCallback((memo: Memo) => {
    setLinkMemos([]);
    setLinkedMemos([]);
    setMemo(memo);
  }, []);

  const handleEditMemoBtnClick = () => {
    props.destroy();
    editorStateService.setEditMemoWithId(memo.id);
  };

  const handleVisibilitySelectorChange = async (visibility: Visibility) => {
    if (memo.visibility === visibility) {
      return;
    }

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
      <Only when={!userService.isVisitorMode()}>
        <div className="card-header-container">
          <div className="visibility-selector-container">
            <Icon.Eye className="icon-img" />
            <Selector
              className="visibility-selector"
              dataSource={VISIBILITY_SELECTOR_ITEMS}
              value={memo.visibility}
              handleValueChanged={(value) => handleVisibilitySelectorChange(value as Visibility)}
            />
          </div>
        </div>
      </Only>
      <div className="memo-card-container">
        <div className="header-container">
          <p className="time-text" onClick={handleMemoCreatedAtClick}>
            {utils.getDateTimeString(memo.createdTs)}
          </p>
          <div className="btns-container">
            <Only when={!userService.isVisitorMode()}>
              <>
                <button className="btn edit-btn" onClick={handleEditMemoBtnClick}>
                  <Icon.Edit3 className="icon-img" />
                </button>
                <span className="split-line">/</span>
              </>
            </Only>
            <button className="btn close-btn" onClick={props.destroy}>
              <Icon.X className="icon-img" />
            </button>
          </div>
        </div>
        <div className="memo-container">
          <MemoContent
            className=""
            displayConfig={{ enableExpand: false }}
            content={memo.content}
            onMemoContentClick={handleMemoContentClick}
          />
          <MemoResources memo={memo} />
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
  generateDialog(
    {
      className: "memo-card-dialog",
    },
    MemoCardDialog,
    { memo }
  );
}
