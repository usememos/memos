export type Command = {
  name: string;
  description?: string;
  run: () => string;
  cursorOffset?: number;
};
