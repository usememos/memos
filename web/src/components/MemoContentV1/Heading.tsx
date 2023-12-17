import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  level: number;
  children: Node[];
}

const Heading: React.FC<Props> = ({ level, children }: Props) => {
  const Head = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Head>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} node={child} />
      ))}
    </Head>
  );
};

export default Heading;
