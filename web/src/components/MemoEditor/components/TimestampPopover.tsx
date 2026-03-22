import { type FC, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslate } from "@/utils/i18n";
import { useEditorContext } from "../state";

const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
