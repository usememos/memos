import { useEffect, useRef, useState } from "react";
import Renderer from "@/components/MemoContent/Renderer";
import { markdownServiceClient } from "@/grpcweb";
import { Node, NodeType } from "@/types/proto/api/v2/markdown_service";

interface Props {
  className?: string;
  content: string | undefined;
}

export default function Preview(props: Props) {
  const { className, content } = props;
  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;
  const memoPreviewContainerRef = useRef<HTMLDivElement>(null);
  const [previewNodes, setPrevewNodes] = useState<Array<Node>>([]);

  useEffect(() => {
    if (content) {
      markdownServiceClient.parseMarkdown({ markdown: content }).then((res) => setPrevewNodes(res.nodes));
    } else {
      setPrevewNodes([]);
    }
  }, [content]);

  return (
    <div className={`w-full flex flex-col justify-start items-start text-gray-800 dark:text-gray-300 ${className || ""}`}>
      <div ref={memoPreviewContainerRef} className="w-full max-w-full word-break text-base leading-6 space-y-1">
        {previewNodes.map((node, index) => {
          if (prevNode?.type !== NodeType.LINE_BREAK && node.type === NodeType.LINE_BREAK && skipNextLineBreakFlag) {
            skipNextLineBreakFlag = false;
            return null;
          }

          prevNode = node;
          skipNextLineBreakFlag = true;
          return <Renderer key={`${node.type}-${index}`} index={String(index)} node={node} />;
        })}
      </div>
    </div>
  );
}
