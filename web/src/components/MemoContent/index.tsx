import { useRef } from "react";
import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  nodes: Node[];
  className?: string;
  onMemoContentClick?: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, onMemoContentClick } = props;
  const memoContentContainerRef = useRef<HTMLDivElement>(null);

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    if (onMemoContentClick) {
      onMemoContentClick(e);
    }
  };

  return (
    <div className={`w-full flex flex-col justify-start items-start text-gray-800 dark:text-gray-300 ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        className="w-full max-w-full word-break text-base leading-6 space-y-1"
        onClick={handleMemoContentClick}
      >
        {props.nodes.map((node, index) => (
          <Renderer key={`${node.type}-${index}`} node={node} />
        ))}
      </div>
    </div>
  );
};

export default MemoContent;
