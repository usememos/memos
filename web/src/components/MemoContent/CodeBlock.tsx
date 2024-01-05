import { IconButton } from "@mui/joy";
import classNames from "classnames";
import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import toast from "react-hot-toast";
import Icon from "../Icon";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  language: string;
  content: string;
}

const CodeBlock: React.FC<Props> = ({ language, content }: Props) => {
  const formatedLanguage = language.toLowerCase() || "plaintext";
  let highlightedCode = hljs.highlightAuto(content).value;

  try {
    const temp = hljs.highlight(content, {
      language: formatedLanguage,
    }).value;
    highlightedCode = temp;
  } catch (error) {
    // Skip error and use default highlighted code.
  }

  const handleCopyButtonClick = () => {
    copy(content);
    toast.success("Copied to clipboard!");
  };

  return (
    <pre className="w-full my-1 p-3 rounded bg-gray-100 dark:bg-zinc-700 whitespace-pre-wrap relative">
      <IconButton
        size="sm"
        className="!absolute top-0.5 right-0.5 opacity-50"
        sx={{
          "--IconButton-size": "24px",
        }}
        onClick={handleCopyButtonClick}
      >
        <Icon.Copy className="w-4 h-auto" />
      </IconButton>
      <code
        className={classNames(`language-${formatedLanguage}`, "block text-sm")}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      ></code>
    </pre>
  );
};

export default CodeBlock;
