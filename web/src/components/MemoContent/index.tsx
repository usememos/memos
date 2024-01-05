import { useRef } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore } from "@/store/v1";
import { Node, NodeType } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

interface Props {
  memoId: number;
  nodes: Node[];
  readonly?: boolean;
  className?: string;
  onMemoContentClick?: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, memoId, nodes, onMemoContentClick } = props;
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const allowEdit = currentUser?.id === memoStore.getMemoById(memoId)?.creatorId && !props.readonly;

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    if (onMemoContentClick) {
      onMemoContentClick(e);
    }
  };

  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  return (
    <RendererContext.Provider
      value={{
        memoId,
        nodes,
        readonly: !allowEdit,
      }}
    >
      <div className={`w-full flex flex-col justify-start items-start text-gray-800 dark:text-gray-300 ${className || ""}`}>
        <div
          ref={memoContentContainerRef}
          className="w-full max-w-full word-break text-base leading-6 space-y-1"
          onClick={handleMemoContentClick}
        >
          {nodes.map((node, index) => {
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
    </RendererContext.Provider>
  );
};

export default MemoContent;
