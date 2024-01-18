import { createContext } from "react";
import { Node } from "@/types/proto/api/v2/markdown_service";

interface Context {
  nodes: Node[];
  memoId?: number;
  readonly?: boolean;
  disableFilter?: boolean;
}

export const RendererContext = createContext<Context>({
  nodes: [],
});
