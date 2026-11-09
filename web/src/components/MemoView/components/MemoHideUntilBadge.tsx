import { timestampDate } from "@bufbuild/protobuf/wkt";
import { AlarmClockIcon } from "lucide-react";
import { isHiddenUntilFuture } from "@/components/MemoEditor/utils/hideUntil";
import { Badge } from "@/components/ui/badge";
import i18n from "@/i18n";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface MemoHideUntilBadgeProps {
  hideUntil: Memo["hideUntil"];
}

const MemoHideUntilBadge = ({ hideUntil }: MemoHideUntilBadgeProps) => {
  const t = useTranslate();
  if (!hideUntil) return null;

  const date = timestampDate(hideUntil);
  if (!isHiddenUntilFuture(date)) return null;

  const label = t("memo.hidden-until", { date: date.toLocaleString(i18n.language) });
  return (
    <Badge
      variant="outline"
      shape="pill"
      title={label}
      aria-label={label}
      className="shrink-0 gap-1 border-border/60 bg-muted/30 px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
    >
      <AlarmClockIcon className="size-3" strokeWidth={1.8} />
      <span className="hidden sm:inline">{label}</span>
    </Badge>
  );
};

export default MemoHideUntilBadge;
