import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  index: string;
  children: Node[];
}

const List: React.FC<Props> = ({ children }: Props) => {
  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  return (
    <dl>
      {children.map((child, index) => {
        if (prevNode?.type !== NodeType.LINE_BREAK && child.type === NodeType.LINE_BREAK && skipNextLineBreakFlag) {
          skipNextLineBreakFlag = false;
          return null;
        }

        prevNode = child;
        skipNextLineBreakFlag = true;
        return <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />;
      })}
    </dl>
  );
};

export default List;
