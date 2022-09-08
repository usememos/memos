import { useRef } from "react";
import { formatMemoContent } from "../helpers/marked";
import "../less/memo-content.less";

interface Props {
  className: string;
  content: string;
  onMemoContentClick: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, content, onMemoContentClick } = props;
  const memoContentContainerRef = useRef<HTMLDivElement>(null);

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    onMemoContentClick(e);
  };

  return (
    <div
      ref={memoContentContainerRef}
      className={`memo-content-text ${className}`}
      onClick={handleMemoContentClick}
      dangerouslySetInnerHTML={{ __html: formatMemoContent(content) }}
    ></div>
  );
};

export default MemoContent;
