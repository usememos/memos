import { Tooltip } from "@mui/joy";
import { ExternalLinkIcon } from "lucide-react";
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
    <Tooltip title={title ?? t("common.learn-more")} placement="top">
      <a className={`text-gray-500 dark:text-gray-400 hover:text-blue-600 ${className}`} href={url} target="_blank">
        <ExternalLinkIcon className="w-4 h-auto" />
      </a>
    </Tooltip>
  );
};

export default LearnMore;
