import type { Element } from "hast";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { isMentionElement, isTagElement, isTaskListItemElement } from "@/types/markdown";
import { rehypeHeadingId } from "@/utils/rehype-plugins/rehype-heading-id";
import { remarkDisableSetext } from "@/utils/remark-plugins/remark-disable-setext";
import { remarkMention } from "@/utils/remark-plugins/remark-mention";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkSplitMixedTaskLists } from "@/utils/remark-plugins/remark-split-mixed-task-lists";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { CodeBlock } from "./CodeBlock";
import { SANITIZE_SCHEMA } from "./constants";
import { MarkdownRenderContext, rootMarkdownRenderContext } from "./MarkdownRenderContext";
import { Mention } from "./Mention";
import { Blockquote, Heading, HorizontalRule, Image, InlineCode, Link, List, ListItem, Paragraph } from "./markdown";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./Table";
import { Tag } from "./Tag";
import { TaskListItem } from "./TaskListItem";
import { TrustedIframe } from "./TrustedIframe";

interface MemoMarkdownRendererProps {
  content: string;
  resolvedMentionUsernames: Set<string>;
}

function getMentionUsername(node: Element, children?: React.ReactNode): string {
  const dataMention = node.properties?.["data-mention"];
  if (typeof dataMention === "string" && dataMention !== "") {
    return dataMention;
  }

  const camelDataMention = (node.properties as Record<string, unknown> | undefined)?.dataMention;
  if (typeof camelDataMention === "string" && camelDataMention !== "") {
    return camelDataMention;
  }

  const text = Array.isArray(children) ? children.join("") : children;
  if (typeof text === "string" && text.startsWith("@")) {
    return text.slice(1).toLowerCase();
  }

  return "";
}

export const MemoMarkdownRenderer = ({ content, resolvedMentionUsernames }: MemoMarkdownRendererProps) => {
  const markdownComponents: Components = {
    input: ({ node, ...inputProps }) => {
      if (node && isTaskListItemElement(node)) {
        return <TaskListItem {...inputProps} node={node} />;
      }
      return <input {...inputProps} />;
    },
    span: ({ node, ...spanProps }) => {
      if (node && isMentionElement(node)) {
        const username = getMentionUsername(node, spanProps.children);
        return <Mention {...spanProps} node={node} data-mention={username} resolved={resolvedMentionUsernames.has(username)} />;
      }
      if (node && isTagElement(node)) {
        return <Tag {...spanProps} node={node} />;
      }
      return <span {...spanProps} />;
    },
    h1: ({ children, ...props }) => (
      <Heading level={1} {...props}>
        {children}
      </Heading>
    ),
    h2: ({ children, ...props }) => (
      <Heading level={2} {...props}>
        {children}
      </Heading>
    ),
    h3: ({ children, ...props }) => (
      <Heading level={3} {...props}>
        {children}
      </Heading>
    ),
    h4: ({ children, ...props }) => (
      <Heading level={4} {...props}>
        {children}
      </Heading>
    ),
    h5: ({ children, ...props }) => (
      <Heading level={5} {...props}>
        {children}
      </Heading>
    ),
    h6: ({ children, ...props }) => (
      <Heading level={6} {...props}>
        {children}
      </Heading>
    ),
    p: ({ children, ...props }) => <Paragraph {...props}>{children}</Paragraph>,
    blockquote: ({ children, ...props }) => <Blockquote {...props}>{children}</Blockquote>,
    hr: (props) => <HorizontalRule {...props} />,
    ul: ({ children, ...props }) => <List {...props}>{children}</List>,
    ol: ({ children, ...props }) => (
      <List ordered {...props}>
        {children}
      </List>
    ),
    li: ({ children, ...props }) => <ListItem {...props}>{children}</ListItem>,
    a: ({ children, ...props }) => <Link {...props}>{children}</Link>,
    code: ({ children, ...props }) => <InlineCode {...props}>{children}</InlineCode>,
    iframe: TrustedIframe,
    img: (props) => <Image {...props} />,
    pre: CodeBlock,
    table: ({ children, ...props }) => <Table {...props}>{children}</Table>,
    thead: ({ children, ...props }) => <TableHead {...props}>{children}</TableHead>,
    tbody: ({ children, ...props }) => <TableBody {...props}>{children}</TableBody>,
    tr: ({ children, ...props }) => <TableRow {...props}>{children}</TableRow>,
    th: ({ children, ...props }) => <TableHeaderCell {...props}>{children}</TableHeaderCell>,
    td: ({ children, ...props }) => <TableCell {...props}>{children}</TableCell>,
  };

  return (
    <MarkdownRenderContext.Provider value={rootMarkdownRenderContext}>
      <ReactMarkdown
        remarkPlugins={[
          remarkDisableSetext,
          remarkMath,
          remarkGfm,
          remarkSplitMixedTaskLists,
          remarkBreaks,
          remarkMention,
          remarkTag,
          remarkPreserveType,
        ]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, SANITIZE_SCHEMA],
          rehypeHeadingId,
          [rehypeKatex, { throwOnError: false, strict: false }],
        ]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </MarkdownRenderContext.Provider>
  );
};
