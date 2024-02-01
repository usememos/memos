import { Node } from "./node";

declare class Go {
  argv: string[];
  env: { [envKey: string]: string };
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  exited: boolean;
  mem: DataView;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare global {
  interface Window {
    Go: typeof Go;
    parse: (content: string) => Node[];
    restore: (input: Node[]) => string;
  }
}

export {};
