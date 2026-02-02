import type { Element } from "hast";

/**
 * Props passed by react-markdown to custom components
 * Includes the AST node for advanced use cases
 */
export interface ReactMarkdownProps {
  node?: Element;
}
