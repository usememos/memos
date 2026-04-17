import { CalendarClockIcon, XIcon } from "lucide-react";
import { type FC, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { useEditorContext } from "../state";

const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Format a Date as a value for <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const TimestampInput: FC<{
  label: string;
  date: Date | undefined;
  onChange: (date: Date) => void;
}> = ({ label, date, onChange }) => {
  const initialValue = useRef(date ? formatDate(date) : "");
  const [value, setValue] = useState(initialValue.current);
  const [invalid, setInvalid] = useState(false);

  const handleBlur = () => {
    const parsed = parseDate(value);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {value !== initialValue.current && <span className="text-primary ml-0.5">*</span>}
      </label>
      <input
        type="text"
        className="block w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono data-[invalid=true]:border-destructive"
        data-invalid={invalid}
        placeholder={DATETIME_FORMAT}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
};

/** Popover shown when editing an existing memo (full create + update time editing). */
export const TimestampPopover: FC = () => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { createTime, updateTime } = state.timestamps;

  if (!createTime) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-auto text-sm text-muted-foreground text-left hover:text-foreground transition-colors cursor-pointer"
        >
          {formatDate(createTime)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2 pt-1 space-y-1">
        <TimestampInput
          label={t("common.created-at")}
          date={createTime}
          onChange={(d) => dispatch(actions.setTimestamps({ createTime: d }))}
        />
        <TimestampInput
          label={t("common.last-updated-at")}
          date={updateTime}
          onChange={(d) => dispatch(actions.setTimestamps({ updateTime: d }))}
        />
      </PopoverContent>
    </Popover>
  );
};

/** Calendar icon with a date & time picker for backdating new memos. */
export const BackdatePopover: FC = () => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { createTime } = state.timestamps;
  const [open, setOpen] = useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    if (!Number.isNaN(date.getTime())) {
      dispatch(actions.setTimestamps({ createTime: date }));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(actions.setTimestamps({ createTime: undefined }));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors cursor-pointer",
            createTime ? "text-foreground hover:text-foreground/80" : "text-muted-foreground hover:text-foreground",
          )}
          title={t("editor.set-creation-date")}
        >
          <CalendarClockIcon className="size-4" />
          {createTime && <span className="font-mono text-xs">{formatDate(createTime)}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t("editor.set-creation-date")}</label>
        <input
          type="datetime-local"
          className="block w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={createTime ? toDatetimeLocalValue(createTime) : ""}
          onChange={handleDateChange}
        />
        {createTime && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <XIcon className="size-3" />
            {t("common.clear")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
