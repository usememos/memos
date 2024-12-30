import clsx from "clsx";
import { useRef } from "react";
import { useScrollMask } from "@/hooks/useScrollMask";
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  children: Node[];
}

const Paragraph: React.FC<Props> = ({ children }: Props) => {
  const isChildrenAllImage = children.every((child) => child.type === NodeType.IMAGE);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const { ScrollMask } = useScrollMask(isChildrenAllImage ? paragraphRef : { current: null });

  return (
    <p ref={paragraphRef} className={clsx("relative", isChildrenAllImage && ["flex gap-3 overflow-x-auto", "scrollbar-hide"])}>
      {isChildrenAllImage && <ScrollMask />}
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </p>
  );
};

export default Paragraph;
