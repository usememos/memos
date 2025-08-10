import { useMemo } from "react";
import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  number: string;
  indent: number;
  children: Node[];
}

const OrderedListItem: React.FC<Props> = ({ children, number }: Props) => {
  const ml = useMemo(
    () =>
      number.length > 1
        ? {
            marginLeft: 8 * (number.length - 1),
          }
        : {},
    [number],
  );

  return (
    <li style={ml}>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </li>
  );
};

export default OrderedListItem;
