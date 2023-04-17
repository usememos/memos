import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import "@/less/memos-selector-dialog.less";
import { useMemoStore } from "@/store/module";
import InputField from "@/components/kit/InputField";
import { useCallback, useState } from "react";
import { marked } from "@/labs/marked";
import { blockElementParserListNonInteractive, inlineElementParserListNonInteractive } from "@/labs/marked/parser";
import { getRelativeTimeString } from "@/helpers/datetime";
import useDebounce from "@/hooks/useDebounce";

type Props = DialogProps & { onSelectMemo?: (memoId: number) => void };

const MemosSelectorDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const memos = useMemoStore().state.memos ?? [];
  const [textSearch, setTextSearch] = useState("");
  const [textSearchDebounced, setTextSearchDebounced] = useState(textSearch);

  useDebounce(() => setTextSearchDebounced(textSearch), 200, [textSearch]);

  const selectMemo = useCallback(
    (memoId: number) => {
      if (props.onSelectMemo) {
        props.onSelectMemo(memoId);
      }
    },
    [props.onSelectMemo]
  );

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("memo.select")}</p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <InputField
          type="search"
          icon={Icon.Search}
          placeholder={t("memo.search-placeholder")}
          onChange={(e) => {
            setTextSearch(e.target.value);
          }}
        />

        {memos
          .filter((m) => (textSearchDebounced ? m.content.toLowerCase().includes(textSearchDebounced.toLowerCase()) : true))
          .map((memo) => (
            <button
              key={memo.id}
              className="memo-wrapper text-left"
              onClick={() => {
                selectMemo(memo.id);
                destroy();
              }}
            >
              <div className="memo-top-wrapper">
                <div className="status-text-container">
                  <span className="time-text">
                    m/{memo.id}
                    <span className="ml-2 italic">{getRelativeTimeString(memo.createdTs)}</span>
                  </span>
                </div>
              </div>
              <div className="memo-content-wrapper max-h-32 overflow-y-hidden">
                <div className="memo-content-text">
                  {marked(memo.content, blockElementParserListNonInteractive, inlineElementParserListNonInteractive)}
                </div>
              </div>
            </button>
          ))}
      </div>
    </>
  );
};

export default function showMemosSelectorDialog({ onSelectMemo }: Pick<Props, "onSelectMemo">) {
  generateDialog(
    {
      className: "memos-selector-dialog",
      dialogName: "memos-selector-dialog",
    },
    MemosSelectorDialog,
    { onSelectMemo }
  );
}
