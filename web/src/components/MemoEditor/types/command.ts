export type Command = {
  name: string;
  run: () => string;
  cursorOffset?: number;
};
