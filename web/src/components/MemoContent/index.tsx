import { isUndefined } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import { markdownServiceClient } from "@/grpcweb";
import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  content: string;
  nodes?: Node[];
  className?: string;
  onMemoContentClick?: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, content, onMemoContentClick } = props;
  const [nodes, setNodes] = useState<Node[]>(props.nodes ?? []);
  const memoContentContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUndefined(props.nodes)) {
      return;
    }

    markdownServiceClient
      .parseMarkdown({
        markdown: content,
      })
      .then(({ nodes }) => {
        setNodes(nodes);
      });
  }, [content, props.nodes]);

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
        {nodes.map((node, index) => (
          <Renderer key={`${node.type}-${index}`} node={node} />
        ))}
      </div>
    </div>
  );
};

export default MemoContent;
