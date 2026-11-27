import { Tooltip } from "@usememos/ui";
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
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<a className={`text-mu-text-secondary hover:text-mu-accent ${className}`} href={url} target="_blank" />}>
          <ExternalLinkIcon className="mu-icon" />
        </Tooltip.Trigger>
        <Tooltip.Popup>
          <p>{title ?? t("common.learn-more")}</p>
        </Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default LearnMore;
