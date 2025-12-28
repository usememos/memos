import type { Data, Element as HastElement } from "hast";

export interface TagNode {
  type: "tagNode";
  value: string;
  data: TagNodeData;
}

export interface TagNodeData {
  hName: "span";
  hProperties: TagNodeProperties;
  hChildren: Array<{ type: "text"; value: string }>;
}

export interface TagNodeProperties {
  className: string;
  "data-tag": string;
}

export interface ExtendedData extends Data {
  mdastType?: string;
}

export function hasExtendedData(node: unknown): node is { data: ExtendedData } {
  return typeof node === "object" && node !== null && "data" in node && typeof (node as { data: unknown }).data === "object";
}

export function isTagElement(node: HastElement): boolean {
  if (hasExtendedData(node) && node.data.mdastType === "tagNode") {
    return true;
  }

  const className = node.properties?.className;
  if (Array.isArray(className) && className.includes("tag")) {
    return true;
  }

  return false;
}

export function isTaskListItemElement(node: HastElement): boolean {
  const type = node.properties?.type;
  return typeof type === "string" && type === "checkbox";
}
