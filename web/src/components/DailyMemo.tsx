import * as utils from "../helpers/utils";
import MemoContent, { DisplayConfig } from "./MemoContent";
import MemoResources from "./MemoResources";
import "../less/daily-memo.less";

interface Props {
  memo: Memo;
}

const DailyMemo: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const displayTimeStr = utils.getTimeString(memo.displayTs);
  const displayConfig: DisplayConfig = {
    enableExpand: false,
  };

  return (
    <div className="daily-memo-wrapper">
      <div className="time-wrapper">
        <span className="normal-text">{displayTimeStr}</span>
      </div>
      <div className="memo-container">
        <MemoContent content={memo.content} displayConfig={displayConfig} />
        <MemoResources resourceList={memo.resourceList} style="col" />
      </div>
      <div className="split-line"></div>
    </div>
  );
};

export default DailyMemo;
