import { Separator } from "@/components/ui/separator";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  symbol: string;
}

const HorizontalRule: React.FC<Props> = () => {
  return <Separator className="my-3!" />;
};

export default HorizontalRule;
