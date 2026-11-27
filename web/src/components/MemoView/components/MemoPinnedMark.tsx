import { useTranslate } from "@/utils/i18n";

/** The pinned corner is a status mark, not a control, so it is named for screen readers but carries no tooltip. */
const MemoPinnedMark = () => {
  const t = useTranslate();

  return (
    <span
      role="img"
      aria-label={t("memo.pinned")}
      className="absolute -right-px -top-px size-5 rounded-tr-mu-lg bg-mu-warning [clip-path:polygon(0_0,100%_0,100%_100%)] transition-[width,height] duration-160 ease-out pointer-fine:group-hover/memo:size-6 motion-reduce:transition-none"
    />
  );
};

export default MemoPinnedMark;
