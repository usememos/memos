import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  level: number;
  children: Node[];
}

const Heading: React.FC<Props> = ({ level, children }: Props) => {
  const Head = `h${level}` as keyof JSX.IntrinsicElements;
  const className = (() => {
    switch (level) {
      case 1:
        return "text-5xl leading-normal font-bold";
      case 2:
        return "text-3xl leading-normal font-medium";
      case 3:
        return "text-xl leading-normal font-medium";
      case 4:
        return "text-lg font-bold";
    }
  })();

  return (
    <Head className={className}>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </Head>
  );
};

export default Heading;
