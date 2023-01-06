export const matcher = (rawStr: string, regexp: RegExp) => {
  const matchResult = rawStr.match(regexp);
  return matchResult;
};
