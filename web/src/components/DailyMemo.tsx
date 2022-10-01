import * as utils from "../helpers/utils";
import MemoContent, { DisplayConfig } from "./MemoContent";
import MemoResources from "./MemoResources";
import "../less/daily-memo.less";

interface DailyMemo extends Memo {
  createdAtStr: string;
  timeStr: string;
}

interface Props {
  memo: Memo;
}

const DailyMemo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo } = props;
  const memo: DailyMemo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
    timeStr: utils.getTimeString(propsMemo.createdTs),
  };
  const displayConfig: DisplayConfig = {
    enableExpand: false,
    showInlineImage: true,
  };

  return (
    <div className="daily-memo-wrapper">
      <div className="time-wrapper">
        <span className="normal-text">{memo.timeStr}</span>
      </div>
      <div className="memo-container">
        <MemoContent content={memo.content} displayConfig={displayConfig} />
        <MemoResources memo={memo} />
      </div>
      <div className="split-line"></div>
    </div>
  );
};

export default DailyMemo;
