import { createElement } from "react";

interface Props {
  tagName: string;
  attributes: { [key: string]: string };
}

const HTMLElement: React.FC<Props> = ({ tagName, attributes }: Props) => {
  return createElement(tagName, attributes);
};

export default HTMLElement;
