import { PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromDate } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { parseLocalDate } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export interface DayPanelProps {
  /** `YYYY-MM-DD` */
  date: string;
  /** The day's memos in time order, straight from the month model. */
  memos: Memo[];
  /** Present when the panel can be dismissed (the side panel); the inline phone list cannot. */
  onClose?: () => void;
}

/**
 * One day's memos, oldest first, rendered from the month already in hand: no second fetch, and
 * a day reads as it unfolded, like the rows in its grid cell. The cards are the ordinary memo
 * cards, so editing, reactions and comments behave exactly as on Home. The day ends with a
 * quiet "new memo" row that expands into the editor in place, the way journals append at the
 * end of a day; the memo it saves seeds its creation time to that date and lands right above it.
 */
export const DayPanel = ({ date, memos, onClose }: DayPanelProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const { isUserSettingsInitialized } = useAuth();
  const { selectedSpaceName } = useSpaceContext();
  const { compactMode } = useView();
  // Remembering which day is being composed for closes the composer the moment the day
  // changes, so a half-written memo can never silently move dates.
  const [composingFor, setComposingFor] = useState<string>();
  const composing = composingFor === date;

  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromDate(date), [date]);
  const dateLabel = useMemo(
    () => parseLocalDate(date)?.toLocaleDateString(i18n.language, { weekday: "long", month: "long", day: "numeric" }) ?? date,
    [date, i18n.language],
  );
  const contents = useMemo(() => memos.map((memo) => memo.content), [memos]);
  const userNames = useMemo(
    () => Array.from(new Set(memos.flatMap((memo) => memo.reactions.map((reaction) => reaction.creator)))),
    [memos],
  );

  return (
    <section aria-label={dateLabel} className="flex w-full flex-col">
      <header className="mb-3 flex items-center gap-0.5 border-b border-border/70 pb-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground">{dateLabel}</h2>
        {onClose && (
          <button
            type="button"
            aria-label={t("calendar.close-day")}
            className={cn(buttonVariants({ variant: "quiet", size: "icon-compact" }))}
            onClick={onClose}
          >
            <XIcon strokeWidth={1.8} />
          </button>
        )}
      </header>
      <NewMemoProvider>
        <MentionResolutionProvider contents={contents} userNames={userNames}>
          {memos.map((memo) => (
            <MemoView
              key={memo.name}
              memo={memo}
              timeDisplay="time"
              showVisibility
              showPinned
              showSpace={!selectedSpaceName}
              compact={compactMode}
            />
          ))}
        </MentionResolutionProvider>
        {isUserSettingsInitialized &&
          (composing ? (
            <MemoEditor
              cacheKey={`calendar-day-editor:${date}`}
              autoFocus
              placeholder={t("editor.any-thoughts")}
              defaultCreateTime={defaultCreateTime}
              defaultSpace={selectedSpaceName}
              onConfirm={() => setComposingFor(undefined)}
              onCancel={() => setComposingFor(undefined)}
            />
          ) : (
            <button
              type="button"
              // The cards' own bottom margin sets the gap; the chip's edge lines up with theirs.
              className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "self-start")}
              onClick={() => setComposingFor(date)}
            >
              <PlusIcon strokeWidth={1.8} />
              <span>{t("calendar.new-memo-on-day")}</span>
            </button>
          ))}
      </NewMemoProvider>
    </section>
  );
};
