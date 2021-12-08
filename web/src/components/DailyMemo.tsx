import { IMAGE_URL_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { formatMemoContent } from "./Memo";
import Only from "./common/OnlyWhen";
import "../less/daily-memo.less";

interface DailyMemo extends FormattedMemo {
  timeStr: string;
}

interface Props {
  memo: Model.Memo;
}

const DailyMemo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo } = props;
  const memo: DailyMemo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdAt),
    timeStr: utils.getTimeString(propsMemo.createdAt),
  };
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);

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
              <img key={idx} crossOrigin="anonymous" src={imgUrl} decoding="async" />
            ))}
          </div>
        </Only>
      </div>
    </div>
  );
};

export default DailyMemo;
