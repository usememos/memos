export const BR_REG = /^(\n+)/;

const renderer = (rawStr: string) => {
  const length = rawStr.split("\n").length - 1;
  const brList = [];
  for (let i = 0; i < length; i++) {
    brList.push(<br key={i} />);
  }
  return <>{...brList}</>;
};

export default {
  name: "br",
  regexp: BR_REG,
  renderer,
};
