import { IMAGE_URL_REG } from "../helpers/consts";
import * as utils from "../helpers/utils";
import Only from "./common/OnlyWhen";
import { formatMemoContent } from "./Memo";
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
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  return (
    <div className="daily-memo-wrapper">
      <div className="time-wrapper">
        <span className="normal-text">{memo.timeStr}</span>
      </div>
      <div className="memo-content-container">
        <div className="memo-content-text" dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}></div>
        <Only when={imageUrls.length > 0}>
          <div className="images-container">
            {imageUrls.map((imgUrl, idx) => (
              <img key={idx} src={imgUrl} decoding="async" />
            ))}
          </div>
        </Only>
      </div>
      <div className="split-line"></div>
    </div>
  );
};

export default DailyMemo;
