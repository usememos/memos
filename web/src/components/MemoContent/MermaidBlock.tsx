import mermaid from "mermaid";
import { useEffect } from "react";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  __html: string;
}

const CodeBlock: React.FC<Props> = ({ __html, className }: Props) => {
  useEffect(() => {
    // Render mermaid
    mermaid.run();
  });

  return <pre className={className} dangerouslySetInnerHTML={{ __html }}></pre>;
};

export default CodeBlock;
