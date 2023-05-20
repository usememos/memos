import { getTimeString } from "@/helpers/datetime";
import MemoContent from "./MemoContent";
import MemoResourceListView from "./MemoResourceListView";
import "@/less/daily-memo.less";

interface Props {
  memo: Memo;
}

const DailyMemo: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const createdTimeStr = getTimeString(memo.createdTs);

  return (
    <div className="daily-memo-wrapper">
      <div className="time-wrapper">
        <span className="normal-text">{createdTimeStr}</span>
      </div>
      <div className="memo-container">
        <MemoContent content={memo.content} showFull={true} />
        <MemoResourceListView resourceList={memo.resourceList} />
      </div>
      <div className="split-line"></div>
    </div>
  );
};

export default DailyMemo;
