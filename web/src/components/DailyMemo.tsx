import * as utils from "../helpers/utils";
import { formatMemoContent } from "../helpers/marked";
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

  return (
    <div className="daily-memo-wrapper">
      <div className="time-wrapper">
        <span className="normal-text">{memo.timeStr}</span>
      </div>
      <div className="memo-content-container">
        <div
          className="memo-content-text"
          dangerouslySetInnerHTML={{
            __html: formatMemoContent(memo.content, {
              inlineImage: true,
            }),
          }}
        ></div>
      </div>
      <div className="split-line"></div>
    </div>
  );
};

export default DailyMemo;
