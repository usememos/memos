import type { Element } from "hast";
import React from "react";
import { isTagElement, isTaskListItemElement } from "@/types/markdown";

/**
 * Creates a conditional component that renders different components
 * based on AST node type detection
 *
 * @param CustomComponent - Custom component to render when condition matches
 * @param DefaultComponent - Default component/element to render otherwise
 * @param condition - Function to test AST node
 * @returns Conditional wrapper component
 */
export const createConditionalComponent = <P extends Record<string, unknown>>(
  CustomComponent: React.ComponentType<P>,
  DefaultComponent: React.ComponentType<P> | keyof JSX.IntrinsicElements,
  condition: (node: Element) => boolean,
) => {
  return (props: P & { node?: Element }) => {
    const { node, ...restProps } = props;

    // Check AST node to determine which component to use
    if (node && condition(node)) {
      return <CustomComponent {...(restProps as P)} node={node} />;
    }

    // Render default component/element
    if (typeof DefaultComponent === "string") {
      return React.createElement(DefaultComponent, restProps);
    }
    return <DefaultComponent {...(restProps as P)} />;
  };
};

// Re-export type guards for convenience
export { isTagElement as isTagNode, isTaskListItemElement as isTaskListItemNode };
