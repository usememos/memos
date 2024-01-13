import { Divider } from "@mui/joy";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  symbol: string;
}

const HorizontalRule: React.FC<Props> = () => {
  return <Divider className="!my-3" />;
};

export default HorizontalRule;
