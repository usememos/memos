import type React from "react";

/**
 * Extracts code content from a react-markdown code element.
 * Handles the nested structure where code is passed as children.
 *
 * @param children - The children prop from react-markdown (typically a code element)
 * @returns The extracted code content as a string with trailing newline removed
 */
export const extractCodeContent = (children: React.ReactNode): string => {
  const codeElement = children as React.ReactElement;
  return String(codeElement?.props?.children || "").replace(/\n$/, "");
};

/**
 * Extracts the language identifier from a code block's className.
 * react-markdown uses the format "language-xxx" for code blocks.
 *
 * @param className - The className string from a code element
 * @returns The language identifier, or empty string if none found
 */
export const extractLanguage = (className: string): string => {
  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : "";
};
