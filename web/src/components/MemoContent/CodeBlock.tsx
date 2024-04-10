import { Checkbox } from "@mui/joy";
import classNames from "classnames";
import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useTranslate } from "@/utils/i18n";
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
  const formatedLanguage = useMemo(() => (language || "").toLowerCase() || "text", [language]);

  // Users can set Markdown code blocks as `__html` to render HTML directly.
  if (formatedLanguage === SpecialLanguage.HTML) {
    return <div className="w-full overflow-auto !my-2" dangerouslySetInnerHTML={{ __html: content }} />;
  } else if (formatedLanguage === SpecialLanguage.MERMAID) {
    return <MermaidBlock content={content} />;
  }

  const { md } = useResponsiveWidth();
  const t = useTranslate();

  const [wrap, setWrap] = useState(true);
  const handleWrapChange = useCallback(() => setWrap(!wrap), [setWrap, wrap]);

  const highlightedCode: string = useMemo(() => {
    try {
      const lang = hljs.getLanguage(formatedLanguage);
      if (lang) {
        return hljs.highlight(content, {
          language: formatedLanguage,
        }).value;
      }
    } catch (error) {
      // Skip error and use default highlighted code.
    }

    return content;
  }, [formatedLanguage, content]);

  const handleCopyButtonClick = useCallback(() => {
    copy(content);
    toast.success("Copied to clipboard!");
  }, [content]);

  return (
    <div className="w-full my-1 bg-amber-100 border-l-4 border-amber-400 rounded hover:shadow dark:bg-zinc-600 dark:border-zinc-400 relative">
      <div className="w-full px-2 py-1 flex flex-row justify-between items-center text-amber-500 dark:text-zinc-400">
        <span className="text-sm font-mono">{formatedLanguage}</span>
        {md && <Icon.Copy className="w-4 h-auto cursor-pointer hover:opacity-80" onClick={handleCopyButtonClick} />}
      </div>

      <div className="overflow-auto">
        <pre
          className={classNames(wrap ? "whitespace-pre-wrap" : "no-wrap overflow-auto", "w-full p-2 bg-amber-50 dark:bg-zinc-700 relative")}
        >
          <code
            className={classNames(`language-${formatedLanguage}`, "block text-sm leading-5")}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          ></code>
        </pre>
      </div>
      {!md && (
        <div className="sticky flex px-2 h-8 bottom-0 bg-amber-100 dark:bg-zinc-600 rounded items-center">
          <div className="grow h-full">
            <Checkbox className="h-full items-center" label={t("memo.wrapping")} size="sm" checked={wrap} onChange={handleWrapChange} />
          </div>
          <Icon.Copy className="w-4 h-full cursor-pointer hover:opacity-80" onClick={handleCopyButtonClick} />
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
