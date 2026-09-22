import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslate } from "@/utils/i18n";

const MemoPinnedMark = () => {
  const t = useTranslate();

  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={<span role="img" aria-label={t("memo.pinned")} />}
        className="absolute -right-px -top-px size-5 cursor-default rounded-tr-lg bg-warning [clip-path:polygon(0_0,100%_0,100%_100%)] transition-[width,height] duration-160 ease-out pointer-fine:group-hover/memo:size-6 motion-reduce:transition-none"
      />
      <TooltipContent side="left" sideOffset={6}>
        {t("memo.pinned")}
      </TooltipContent>
    </Tooltip>
  );
};

export default MemoPinnedMark;
