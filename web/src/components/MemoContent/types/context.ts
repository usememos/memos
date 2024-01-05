import { createContext } from "react";
import { UNKNOWN_ID } from "@/helpers/consts";
import { Node } from "@/types/proto/api/v2/markdown_service";

interface Context {
  memoId: number;
  nodes: Node[];
  readonly?: boolean;
}

export const RendererContext = createContext<Context>({
  memoId: UNKNOWN_ID,
  nodes: [],
});
