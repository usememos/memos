import classNames from "classnames";
import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import toast from "react-hot-toast";

interface Props {
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
    <pre className="group w-full my-1 p-3 rounded bg-gray-100 dark:bg-zinc-600 whitespace-pre-wrap relative">
      <button
        className="text-xs font-mono italic absolute top-0 right-0 px-2 leading-6 border btn-text rounded opacity-0 group-hover:opacity-60"
        onClick={handleCopyButtonClick}
      >
        copy
      </button>
      <code className={classNames(`language-${formatedLanguage}`, "block")} dangerouslySetInnerHTML={{ __html: highlightedCode }}></code>
    </pre>
  );
};

export default CodeBlock;
