import { BaseProps } from "./types";

interface Props extends BaseProps {}

const LineBreak: React.FC<Props> = () => {
  return <br className="block content-['']" />;
};

export default LineBreak;
