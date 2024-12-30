import clsx from "clsx";
import { useCallback, useRef } from "react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
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

  const renderChildren = useCallback(() => {
    const nodes = children.map((child, index) => {
      return (
        <Renderer
          key={`${child.type}-${index}`}
          index={String(index)}
          node={child}
          imageConfig={isChildrenAllImage ? { enablePhotoView: true } : undefined}
        />
      );
    });

    return isChildrenAllImage ? <PhotoProvider>{nodes}</PhotoProvider> : nodes;
  }, [children, isChildrenAllImage]);

  return (
    <p ref={paragraphRef} className={clsx("relative", isChildrenAllImage && ["flex gap-3 overflow-x-auto", "scrollbar-hide"])}>
      {isChildrenAllImage && <ScrollMask />}
      {renderChildren()}
    </p>
  );
};

export default Paragraph;
