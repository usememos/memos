import { Node } from "./node";

declare global {
  interface Window {
    parse: (content: string) => Node[];
    restore: (input: Node[]) => string;
  }
}

export {};
