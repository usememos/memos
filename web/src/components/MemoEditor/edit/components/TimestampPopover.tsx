import { Popover } from "@usememos/ui";
import { type FC, useId, useRef, useState } from "react";
import { MEMO_TIME_CONTROL_CLASSES } from "@/components/MemoView/constants";
import i18n from "@/i18n";
import { useTranslate } from "@/utils/i18n";
import { useEditorContext, useEditorSelector } from "../state";

const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match || Number(match[1]) === 0) return undefined;
  const date = new Date(0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(Number(match[4]), Number(match[5]), Number(match[6]), 0);
  // Date normalizes overflowing fields (e.g. February 30) instead of rejecting them.
  return formatDate(date) === value ? date : undefined;
}

const TimestampInput: FC<{
  label: string;
  date: Date | undefined;
  onChange: (date: Date) => void;
}> = ({ label, date, onChange }) => {
  const id = useId();
  const initialValue = useRef(date ? formatDate(date) : "");
  const [value, setValue] = useState(initialValue.current);
  const [invalid, setInvalid] = useState(false);

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    const parsed = parseDate(nextValue);
    setInvalid(false);
    if (parsed) {
      // Closing the popover can unmount the input without firing blur.
      // Keep valid edits in the editor store as soon as they are entered.
      onChange(parsed);
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="mu-label-sm text-mu-text-secondary">
        {label}
        {value !== initialValue.current && <span className="text-mu-primary ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="text"
        className="block w-full rounded-mu-md border border-mu-line bg-mu-canvas px-2 py-1 mu-body font-mono data-[invalid=true]:border-mu-danger"
        data-invalid={invalid}
        aria-invalid={invalid}
        placeholder={DATETIME_FORMAT}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setInvalid(!parseDate(value))}
      />
    </div>
  );
};

/** "Now" in the viewer's language, the word the memo card shows for a memo written this moment. */
function nowLabel(): string {
  const word = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(0, "second");
  return word.charAt(0).toLocaleUpperCase(i18n.language) + word.slice(1);
}

/** The memo's time as a control; a memo being written that has no time yet reads "Now". */
export const TimestampPopover: FC = () => {
  const t = useTranslate();
  const { actions, dispatch } = useEditorContext();
  const createTime = useEditorSelector((s) => s.timestamps.createTime);
  const updateTime = useEditorSelector((s) => s.timestamps.updateTime);

  if (!createTime) return <span className="shrink-0 whitespace-nowrap mu-caption text-mu-text-secondary select-none">{nowLabel()}</span>;

  return (
    <Popover.Root>
      <Popover.Trigger render={<button type="button" className={MEMO_TIME_CONTROL_CLASSES} />}>{formatDate(createTime)}</Popover.Trigger>
      <Popover.Popup align="start" className="w-auto">
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
      </Popover.Popup>
    </Popover.Root>
  );
};
