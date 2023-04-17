export interface Parser {
  name: string;
  regexp: RegExp;
  renderer: () => (rawStr: string) => React.ReactElement | string;
}
