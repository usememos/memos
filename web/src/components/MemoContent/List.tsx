import clsx from "clsx";
import React from "react";
import { ListNode_Kind, Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  index: string;
  kind: ListNode_Kind;
  indent: number;
  children: Node[];
}

const List: React.FC<Props> = ({ kind, indent, children }: Props) => {
  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  const getListContainer = (kind: ListNode_Kind) => {
    switch (kind) {
      case ListNode_Kind.ORDERED:
        return "ol";
      case ListNode_Kind.UNORDERED:
        return "ul";
      case ListNode_Kind.DESCRIPTION:
        return "dl";
      default:
        return "div";
    }
  };

  return React.createElement(
    getListContainer(kind),
    {
      className: clsx(
        `list-inside ${kind === ListNode_Kind.ORDERED ? "list-decimal" : kind === ListNode_Kind.UNORDERED ? "list-disc" : "list-none"}`,
        indent > 0 ? `pl-${2 * indent}` : "",
      ),
    },
    children.map((child, index) => {
      if (prevNode?.type !== NodeType.LINE_BREAK && child.type === NodeType.LINE_BREAK && skipNextLineBreakFlag) {
        skipNextLineBreakFlag = false;
        return null;
      }

      prevNode = child;
      skipNextLineBreakFlag = true;
      return <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />;
    }),
  );
};

export default List;
