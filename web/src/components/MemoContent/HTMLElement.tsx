import { createElement } from "react";
import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  tagName: string;
  attributes: { [key: string]: string };
  children: Node[];
  isSelfClosing: boolean;
}

const HTMLElement: React.FC<Props> = ({ tagName, attributes, children, isSelfClosing }: Props) => {
  if (isSelfClosing) {
    return createElement(tagName, attributes);
  }

  return createElement(
    tagName,
    attributes,
    children.map((child, index) => <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />),
  );
};

export default HTMLElement;
