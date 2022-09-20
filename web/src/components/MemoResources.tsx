import { IMAGE_URL_REG } from "../helpers/marked";
import Image from "./Image";
import "../less/memo-resources.less";

interface Props {
  className?: string;
  memo: Memo;
}

const MemoResources: React.FC<Props> = (props: Props) => {
  const { className, memo } = props;
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  return (
    <div className="resource-wrapper">
      {imageUrls.length > 0 && (
        <div className={`images-wrapper ${className ?? ""}`}>
          {imageUrls.map((imgUrl, idx) => (
            <Image className="memo-img" key={idx} imgUrl={imgUrl} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoResources;
