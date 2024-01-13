import { useEffect, useState } from "react";
import { markdownServiceClient } from "@/grpcweb";
import { Node } from "@/types/proto/api/v2/markdown_service";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import MemoContent from "./MemoContent";

interface Props extends DialogProps {
  content: string;
}

const PreviewMarkdownDialog: React.FC<Props> = ({ content, destroy }: Props) => {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    (async () => {
      const { nodes } = await markdownServiceClient.parseMarkdown({
        markdown: content,
      });
      setNodes(nodes);
    })();
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <div className="flex flex-row justify-start items-center">
          <p className="text-black opacity-80 dark:text-gray-200">Preview</p>
        </div>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[32rem]">
        <MemoContent nodes={nodes} />
      </div>
    </>
  );
};

export default function showPreviewMarkdownDialog(content: string): void {
  generateDialog(
    {
      className: "preview-markdown-dialog",
      dialogName: "preview-markdown-dialog",
      containerClassName: "dark:!bg-zinc-800",
    },
    PreviewMarkdownDialog,
    {
      content,
    }
  );
}
