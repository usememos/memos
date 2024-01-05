import { BaseProps } from "./types";

interface Props extends BaseProps {
  symbol: string;
}

const HorizontalRule: React.FC<Props> = () => {
  return <hr />;
};

export default HorizontalRule;
