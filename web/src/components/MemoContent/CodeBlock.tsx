import classNames from "classnames";
import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import toast from "react-hot-toast";
import Icon from "../Icon";
import MermaidBlock from "./MermaidBlock";
import { BaseProps } from "./types";

// Special languages that are rendered differently.
enum SpecialLanguage {
  HTML = "__html",
  MERMAID = "mermaid",
}

interface Props extends BaseProps {
  language: string;
  content: string;
}

const CodeBlock: React.FC<Props> = ({ language, content }: Props) => {
  const formatedLanguage = (language || "").toLowerCase() || "text";
  // Users can set Markdown code blocks as `__html` to render HTML directly.
  if (formatedLanguage === SpecialLanguage.HTML) {
    return <div className="w-full overflow-auto !my-2" dangerouslySetInnerHTML={{ __html: content }} />;
  } else if (formatedLanguage === SpecialLanguage.MERMAID) {
    return <MermaidBlock content={content} />;
  }

  let highlightedCode = content;
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
    <div className="w-full my-1 bg-amber-100 border-l-4 border-amber-400 rounded overflow-clip hover:shadow dark:bg-zinc-600 dark:border-zinc-400">
      <div className="w-full px-2 py-1 flex flex-row justify-between items-center text-amber-500 dark:text-zinc-400">
        <span className="text-sm font-mono">{formatedLanguage}</span>
        <Icon.Copy className="w-4 h-auto cursor-pointer hover:opacity-80" onClick={handleCopyButtonClick} />
      </div>

      <pre className="w-full p-2 bg-amber-50 dark:bg-zinc-700 whitespace-pre-wrap relative">
        <code
          className={classNames(`language-${formatedLanguage}`, "block text-sm leading-5")}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        ></code>
      </pre>
    </div>
  );
};

export default CodeBlock;
