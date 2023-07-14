import { useTranslate } from "@/utils/i18n";

interface Props {
  className?: string;
}

const BetaBadge: React.FC<Props> = (props: Props) => {
  const { className } = props;
  const t = useTranslate();

  return (
    <span
      className={`mx-1 px-1 leading-5 text-xs border dark:border-zinc-600 rounded-full text-gray-500 dark:text-gray-400 ${className ?? ""}`}
    >
      {t("common.beta")}
    </span>
  );
};

export default BetaBadge;
