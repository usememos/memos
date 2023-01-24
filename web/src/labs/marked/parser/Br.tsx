export const BR_REG = /^(\n+)/;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const renderer = (rawStr: string, highlightWord?: string): JSX.Element => {
  const length = rawStr.split("\n").length - 1;
  const brList = [];
  for (let i = 0; i < length; i++) {
    brList.push(<br />);
  }
  return <>{...brList}</>;
};

export default {
  name: "br",
  regexp: BR_REG,
  renderer,
};
