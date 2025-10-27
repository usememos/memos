import React from "react";

/**
 * Creates a conditional component wrapper that checks AST node properties
 * before deciding which component to render.
 *
 * This is more efficient than having every component check its own props,
 * and allows us to use specific HTML element types as defaults.
 *
 * @param CustomComponent - Component to render when condition is met
 * @param DefaultComponent - Component/element to render otherwise
 * @param condition - Function to check if node matches custom component criteria
 */
export const createConditionalComponent = <P extends Record<string, any>>(
  CustomComponent: React.ComponentType<P>,
  DefaultComponent: React.ComponentType<P> | keyof JSX.IntrinsicElements,
  condition: (node: any) => boolean,
) => {
  return (props: P & { node?: any }) => {
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

/**
 * Condition checkers for AST node types
 *
 * These check the original MDAST node type preserved during transformation:
 * - First checks node.data.mdastType (preserved by remarkPreserveType plugin)
 * - Falls back to checking HAST properties/className for compatibility
 */
export const isTagNode = (node: any): boolean => {
  // Check preserved mdast type first
  if (node?.data?.mdastType === "tagNode") {
    return true;
  }
  // Fallback: check hast properties
  return node?.properties?.className?.includes?.("tag") || false;
};

export const isTaskListItemNode = (node: any): boolean => {
  // Task list checkboxes are standard GFM - check element type
  return node?.properties?.type === "checkbox" || false;
};
