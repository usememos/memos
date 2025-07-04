import { ExternalLinkIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslate } from "@/utils/i18n";

interface Props {
  className?: string;
  url: string;
  title?: string;
}

const LearnMore: React.FC<Props> = (props: Props) => {
  const { className, url, title } = props;
  const t = useTranslate();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a className={`text-muted-foreground hover:text-primary ${className}`} href={url} target="_blank">
            <ExternalLinkIcon className="w-4 h-auto" />
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>{title ?? t("common.learn-more")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LearnMore;
