import type { Element } from "hast";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { remarkDisableSetext } from "@/utils/remark-plugins/remark-disable-setext";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { CodeBlock } from "./CodeBlock";
import { isTagNode, isTaskListItemNode } from "./ConditionalComponent";
import { SANITIZE_SCHEMA } from "./constants";
import { useCompactLabel, useCompactMode } from "./hooks";
import { Tag } from "./Tag";
import { TaskListItem } from "./TaskListItem";
import type { MemoContentProps } from "./types";

const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const {
    containerRef: memoContentContainerRef,
    mode: showCompactMode,
    toggle: toggleCompactMode,
  } = useCompactMode(Boolean(props.compact));

  const compactLabel = useCompactLabel(showCompactMode, t as (key: string) => string);

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        className={cn(
          "markdown-content relative w-full max-w-full wrap-break-word text-base leading-6",
          showCompactMode === "ALL" && "line-clamp-6 max-h-60",
          contentClassName,
        )}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <ReactMarkdown
          remarkPlugins={[remarkDisableSetext, remarkGfm, remarkBreaks, remarkMath, remarkTag, remarkPreserveType]}
          rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, SANITIZE_SCHEMA]]}
          components={{
            // Child components consume from MemoViewContext directly
            input: ((inputProps: React.ComponentProps<"input"> & { node?: Element }) => {
              if (inputProps.node && isTaskListItemNode(inputProps.node)) {
                return <TaskListItem {...inputProps} />;
              }
              return <input {...inputProps} />;
            }) as React.ComponentType<React.ComponentProps<"input">>,
            span: ((spanProps: React.ComponentProps<"span"> & { node?: Element }) => {
              if (spanProps.node && isTagNode(spanProps.node)) {
                return <Tag {...spanProps} />;
              }
              return <span {...spanProps} />;
            }) as React.ComponentType<React.ComponentProps<"span">>,
            pre: CodeBlock,
            a: ({ href, children, ...aProps }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...aProps}>
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {showCompactMode === "ALL" && (
        <div className="absolute bottom-0 left-0 w-full h-12 bg-linear-to-b from-transparent to-background pointer-events-none"></div>
      )}
      {showCompactMode !== undefined && (
        <div className="w-full mt-1">
          <button
            type="button"
            className="w-auto flex flex-row justify-start items-center cursor-pointer text-sm text-primary hover:opacity-80 text-left"
            onClick={toggleCompactMode}
          >
            {compactLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(MemoContent);
