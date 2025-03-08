import { BaseProps } from "./types";

interface Props extends BaseProps {}

const LineBreak: React.FC<Props> = () => {
  return <div className="h-2 w-full" aria-hidden="true" />;
};

export default LineBreak;
