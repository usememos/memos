import { IconButton } from "@mui/joy";
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
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[32rem]">
        {content !== "" ? <MemoContent nodes={nodes} /> : <p className="text-gray-400 dark:text-gray-600">Nothing to preview</p>}
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
